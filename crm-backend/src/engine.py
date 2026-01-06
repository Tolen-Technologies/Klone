"""LlamaIndex NLSQLTableQueryEngine implementation for CRM queries."""

import logging
from typing import Optional
from urllib.parse import quote_plus

from sqlalchemy import create_engine, text
from llama_index.core import SQLDatabase, PromptTemplate
from llama_index.core.query_engine import NLSQLTableQueryEngine
from llama_index.llms.openai import OpenAI

from .config import Settings, get_settings
from .prompts import (
    TEXT_TO_SQL_PROMPT,
    SEGMENT_GENERATION_PROMPT,
    SEGMENT_VIEW_GENERATION_PROMPT,
    SEGMENT_SQL_ONLY_PROMPT,
    SEGMENT_METADATA_PROMPT,
    CUSTOMER_PERSONALITY_PROMPT,
)

logger = logging.getLogger(__name__)


def strip_markdown_sql(sql: str) -> str:
    """
    Post-processor to strip markdown formatting from LLM-generated SQL.

    Handles:
    - ```sql ... ``` code blocks
    - ``` ... ``` generic code blocks
    - Trailing semicolons
    - Leading/trailing whitespace
    """
    sql = sql.strip()

    # Remove markdown code blocks
    if sql.startswith("```"):
        lines = sql.split("\n")
        # Remove first line (```sql or ```)
        lines = lines[1:]
        # Remove last line if it's just ```
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        sql = "\n".join(lines)

    # Also handle inline backticks at start/end
    sql = sql.strip("`")

    # Remove trailing semicolon
    sql = sql.strip().rstrip(";").strip()

    return sql


class CRMQueryEngine:
    """CRM Query Engine using LlamaIndex NLSQLTableQueryEngine."""

    def __init__(self, settings: Optional[Settings] = None):
        self.settings = settings or get_settings()
        self._engine = None
        self._sql_database = None
        self._query_engine = None
        self._segment_query_engine = None
        self._llm = None

    def _get_connection_uri(self) -> str:
        """Build MySQL connection URI."""
        from urllib.parse import quote_plus

        user = quote_plus(self.settings.db_user)
        password = quote_plus(self.settings.db_password)
        host = self.settings.db_host
        port = self.settings.db_port
        database = self.settings.db_database

        return f"mysql+pymysql://{user}:{password}@{host}:{port}/{database}"

    def _init_engine(self):
        """Initialize SQLAlchemy engine."""
        if self._engine is None:
            uri = self._get_connection_uri()
            logger.info(f"Connecting to MySQL database at {self.settings.db_host}:{self.settings.db_port}")
            self._engine = create_engine(uri)

    def _init_llm(self):
        """Initialize OpenAI LLM."""
        if self._llm is None:
            self._llm = OpenAI(
                api_key=self.settings.openai_api_key,
                model=self.settings.openai_model,
                temperature=0,
            )
            logger.info(f"Initialized OpenAI LLM with model: {self.settings.openai_model}")

    def _init_sql_database(self):
        """Initialize LlamaIndex SQLDatabase."""
        if self._sql_database is None:
            self._init_engine()
            tables = [t.strip() for t in self.settings.db_tables.split(",")]
            self._sql_database = SQLDatabase(
                self._engine,
                include_tables=tables,
            )
            logger.info(f"Initialized SQLDatabase with tables: {tables}")

    def _init_query_engine(self):
        """Initialize NLSQLTableQueryEngine."""
        if self._query_engine is None:
            self._init_sql_database()
            self._init_llm()

            tables = [t.strip() for t in self.settings.db_tables.split(",")]
            text_to_sql_template = PromptTemplate(TEXT_TO_SQL_PROMPT)

            self._query_engine = NLSQLTableQueryEngine(
                sql_database=self._sql_database,
                tables=tables,
                llm=self._llm,
                text_to_sql_prompt=text_to_sql_template,
                streaming=True,
            )
            logger.info("Initialized NLSQLTableQueryEngine")

    def _init_segment_query_engine(self, current_date: str):
        """Initialize NLSQLTableQueryEngine for segment SQL generation (sql_only mode)."""
        self._init_sql_database()
        self._init_llm()

        tables = [t.strip() for t in self.settings.db_tables.split(",")]

        # Create prompt with current_date injected
        segment_prompt = SEGMENT_SQL_ONLY_PROMPT.replace("{current_date}", current_date)
        text_to_sql_template = PromptTemplate(segment_prompt)

        self._segment_query_engine = NLSQLTableQueryEngine(
            sql_database=self._sql_database,
            tables=tables,
            llm=self._llm,
            text_to_sql_prompt=text_to_sql_template,
            sql_only=True,
            synthesize_response=False,
        )
        logger.info("Initialized segment NLSQLTableQueryEngine (sql_only mode)")

    async def query(self, question: str) -> str:
        """
        Execute a natural language query against the CRM database.

        Args:
            question: Natural language question about CRM data

        Returns:
            Natural language response in Indonesian
        """
        self._init_query_engine()

        logger.info(f"Processing query: {question}")

        try:
            response = self._query_engine.query(question)
            result = response.response if hasattr(response, "response") else str(response)
            logger.info("Query completed successfully")
            return result
        except Exception as e:
            logger.error(f"Query error: {e}")
            raise

    async def query_streaming(self, question: str):
        """
        Execute a natural language query with streaming response.

        Args:
            question: Natural language question about CRM data

        Yields:
            Chunks of the response as they're generated
        """
        self._init_query_engine()

        logger.info(f"Processing streaming query: {question}")

        try:
            response = self._query_engine.query(question)

            # Check if response supports streaming
            if hasattr(response, "response_gen"):
                for chunk in response.response_gen:
                    yield chunk
            else:
                # Fallback to non-streaming
                result = response.response if hasattr(response, "response") else str(response)
                yield result

            logger.info("Streaming query completed successfully")
        except Exception as e:
            logger.error(f"Streaming query error: {e}")
            raise

    async def generate_segment(self, description: str) -> dict:
        """
        Generate a customer segment SQL query from natural language description.

        Args:
            description: Natural language description of the segment

        Returns:
            Dict with 'name' and 'sql' keys
        """
        self._init_llm()
        self._init_engine()

        logger.info(f"Generating segment for: {description}")

        prompt = SEGMENT_GENERATION_PROMPT.format(description=description)

        try:
            response = self._llm.complete(prompt)
            result_text = response.text.strip()

            # Parse JSON response
            import json

            # Clean up markdown code blocks if present
            if result_text.startswith("```"):
                result_text = result_text.split("```")[1]
                if result_text.startswith("json"):
                    result_text = result_text[4:]
                result_text = result_text.strip()

            result = json.loads(result_text)
            logger.info(f"Generated segment: {result.get('name')}")
            return result
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse segment response: {e}")
            raise ValueError(f"Invalid segment response format: {result_text}")
        except Exception as e:
            logger.error(f"Segment generation error: {e}")
            raise

    async def execute_segment_sql(self, sql: str) -> list[dict]:
        """
        Execute a segment SQL query and return results.

        Args:
            sql: SQL query to execute

        Returns:
            List of customer records
        """
        self._init_engine()

        logger.info(f"Executing segment SQL: {sql[:100]}...")

        try:
            with self._engine.connect() as conn:
                result = conn.execute(text(sql))
                rows = [dict(row._mapping) for row in result]
                logger.info(f"Segment query returned {len(rows)} rows")
                return rows
        except Exception as e:
            logger.error(f"Segment SQL execution error: {e}")
            raise

    async def create_segment_view(self, segment_id: str, description: str, current_date: str) -> dict:
        """
        Generate SQL using NLSQLTableQueryEngine, validate it, and create MySQL VIEW.

        Uses LlamaIndex's NLSQLTableQueryEngine with sql_only=True for reliable SQL generation,
        then a separate LLM call for generating segment name and description.

        Args:
            segment_id: UUID for the segment
            description: User's natural language description
            current_date: Today's date in YYYY-MM-DD format

        Returns:
            dict with keys: name, description, sql, viewName
        """
        import json

        self._init_engine()
        self._init_llm()

        logger.info(f"Creating segment view for: {description}")

        # 1. Generate SQL using NLSQLTableQueryEngine with sql_only=True
        self._init_segment_query_engine(current_date)

        # Build the query - ask for customer segment based on description
        segment_query = f"Find customers that match: {description}. Return custid, custcode, custname, custemail, mobileno from customer table."

        try:
            response = self._segment_query_engine.query(segment_query)

            # Extract SQL from response
            raw_sql = str(response)
            logger.info(f"Raw SQL from engine: {raw_sql[:200]}...")

            # Post-process: strip markdown formatting
            sql = strip_markdown_sql(raw_sql)

            if not sql:
                raise ValueError("Query SQL tidak valid: SQL kosong")

            logger.info(f"Cleaned SQL for segment: {sql[:100]}...")

            # 2. Validate SQL by executing: SELECT * FROM ({sql}) AS test LIMIT 1
            validation_sql = f"SELECT * FROM ({sql}) AS test LIMIT 1"

            with self._engine.connect() as conn:
                try:
                    conn.execute(text(validation_sql))
                    logger.info("SQL validation successful")
                except Exception as e:
                    logger.error(f"SQL validation failed: {e}")
                    raise ValueError(f"Query SQL tidak valid: {str(e)}")

            # 3. Generate name and description using separate LLM call
            metadata_prompt = SEGMENT_METADATA_PROMPT.format(
                description=description,
                sql=sql
            )

            try:
                metadata_response = self._llm.complete(metadata_prompt)
                metadata_text = metadata_response.text.strip()

                # Clean up markdown if present
                if metadata_text.startswith("```"):
                    lines = metadata_text.split("\n")
                    lines = lines[1:]
                    if lines and lines[-1].strip() == "```":
                        lines = lines[:-1]
                    metadata_text = "\n".join(lines)
                    if metadata_text.startswith("json"):
                        metadata_text = metadata_text[4:].strip()

                metadata = json.loads(metadata_text)
                name = metadata.get("name", f"Segment {segment_id[:8]}")
                segment_description = metadata.get("description", description)
            except (json.JSONDecodeError, Exception) as e:
                logger.warning(f"Failed to parse metadata, using fallback: {e}")
                name = description[:50] if len(description) > 50 else description
                segment_description = description

            logger.info(f"Generated segment metadata: name='{name}'")

            # 4. Create or replace VIEW
            view_name = f"segment_{segment_id}"
            create_view_sql = f"CREATE OR REPLACE VIEW `{view_name}` AS {sql}"

            with self._engine.connect() as conn:
                try:
                    conn.execute(text(create_view_sql))
                    conn.commit()
                    logger.info(f"Created view: {view_name}")
                except Exception as e:
                    logger.error(f"VIEW creation failed: {e}")
                    raise RuntimeError(f"Gagal membuat VIEW di database: {str(e)}")

            # 5. Return result
            return {
                "name": name,
                "description": segment_description,
                "sql": sql,
                "viewName": view_name
            }

        except (ValueError, RuntimeError):
            raise
        except Exception as e:
            logger.error(f"Segment view creation error: {e}")
            raise RuntimeError(f"Gagal membuat segmen: {str(e)}")

    async def refresh_segment_view(self, segment_id: str, original_description: str, current_date: str) -> dict:
        """
        Regenerate and update existing VIEW with new dates - same as create but reuses segment_id.

        Args:
            segment_id: UUID for the segment
            original_description: Original user's natural language description
            current_date: Today's date in YYYY-MM-DD format

        Returns:
            dict with keys: name, description, sql, viewName
        """
        logger.info(f"Refreshing segment view {segment_id}")

        # Use the same logic as create_segment_view
        return await self.create_segment_view(segment_id, original_description, current_date)

    async def execute_view(self, view_name: str) -> list[dict]:
        """
        Execute SELECT * FROM {view_name} and return results.

        Args:
            view_name: Name of the view to execute

        Returns:
            List of customer records
        """
        self._init_engine()

        logger.info(f"Executing view: {view_name}")

        try:
            sql = f"SELECT * FROM `{view_name}`"

            with self._engine.connect() as conn:
                result = conn.execute(text(sql))
                rows = [dict(row._mapping) for row in result]
                logger.info(f"View query returned {len(rows)} rows")
                return rows
        except Exception as e:
            logger.error(f"View execution error: {e}")
            raise RuntimeError(f"Gagal mengeksekusi VIEW: {str(e)}")

    async def get_customer_by_id(self, customer_id: int) -> Optional[dict]:
        """
        Query MySQL for a single customer by custid.

        Args:
            customer_id: The customer ID to look up

        Returns:
            Customer record as dict, or None if not found
        """
        self._init_engine()

        logger.info(f"Fetching customer by ID: {customer_id}")

        try:
            sql = """
                SELECT
                    c.custid,
                    c.custcode,
                    c.custname,
                    c.custtype,
                    c.custemail,
                    c.mobileno,
                    c.custphone1,
                    c.custaddress1,
                    c.birthday,
                    c.joindate,
                    c.status,
                    c.branchno,
                    c.cityid,
                    c.title,
                    c.birthplace,
                    c.createdate,
                    ct.description as customer_type_name,
                    ctd.description as customer_type_detail_name,
                    ci.citydesc as city_name,
                    b.branchname
                FROM customer c
                LEFT JOIN customertype ct ON c.custtype = ct.custtype
                LEFT JOIN customertypedtl ctd ON c.cgroup = ctd.custtypedetail
                LEFT JOIN city ci ON c.cityid = ci.cityid
                LEFT JOIN branch b ON c.branchno = b.branchno
                WHERE c.custid = :customer_id
            """

            with self._engine.connect() as conn:
                result = conn.execute(text(sql), {"customer_id": customer_id})
                row = result.fetchone()

                if row is None:
                    logger.info(f"Customer not found: {customer_id}")
                    return None

                customer = dict(row._mapping)

                # Convert datetime objects to strings for JSON serialization
                for key, value in customer.items():
                    if hasattr(value, 'isoformat'):
                        customer[key] = value.isoformat()

                logger.info(f"Found customer: {customer.get('custname')}")
                return customer

        except Exception as e:
            logger.error(f"Error fetching customer {customer_id}: {e}")
            raise RuntimeError(f"Gagal mengambil data pelanggan: {str(e)}")

    async def generate_customer_personality(self, customer_data: dict) -> dict:
        """
        Use LLM to generate personality analysis based on customer data.

        Args:
            customer_data: Customer data dictionary with transaction history

        Returns:
            Dict with 'summary' and 'preferences' keys
        """
        import json

        self._init_llm()

        logger.info(f"Generating personality for customer: {customer_data.get('custid', 'unknown')}")

        # Format customer data for the prompt
        formatted_data = json.dumps(customer_data, indent=2, ensure_ascii=False, default=str)
        prompt = CUSTOMER_PERSONALITY_PROMPT.format(customer_data=formatted_data)

        try:
            response = self._llm.complete(prompt)
            result_text = response.text.strip()

            # Clean up markdown code blocks if present
            if result_text.startswith("```"):
                lines = result_text.split("\n")
                lines = lines[1:]
                if lines and lines[-1].strip() == "```":
                    lines = lines[:-1]
                result_text = "\n".join(lines)
                if result_text.startswith("json"):
                    result_text = result_text[4:].strip()

            result = json.loads(result_text)

            # Validate required keys
            if "summary" not in result or "preferences" not in result:
                raise ValueError("Response missing required keys: summary, preferences")

            logger.info(f"Generated personality for customer {customer_data.get('custid')}")
            return result

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse personality response: {e}")
            raise ValueError(f"Format respons tidak valid: {result_text}")
        except Exception as e:
            logger.error(f"Personality generation error: {e}")
            raise

    async def chat_with_context(self, messages: list[dict]) -> str:
        """
        Contextual chat using the full messages array.

        This method uses OpenAI directly without SQL querying,
        perfect for customer-specific conversations where context
        is provided in the system message.

        Args:
            messages: List of message dicts with 'role' and 'content'

        Returns:
            Assistant's response as string
        """
        self._init_llm()

        logger.info(f"Processing contextual chat with {len(messages)} messages")

        try:
            from openai import OpenAI as OpenAIClient

            client = OpenAIClient(api_key=self.settings.openai_api_key)

            response = client.chat.completions.create(
                model=self.settings.openai_model,
                messages=messages,
                temperature=0.7,
            )

            result = response.choices[0].message.content
            logger.info("Contextual chat completed successfully")
            return result

        except Exception as e:
            logger.error(f"Contextual chat error: {e}")
            raise

    async def chat_with_context_streaming(self, messages: list[dict]):
        """
        Contextual chat with streaming response.

        Args:
            messages: List of message dicts with 'role' and 'content'

        Yields:
            Chunks of the response as they're generated
        """
        self._init_llm()

        logger.info(f"Processing streaming contextual chat with {len(messages)} messages")

        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=self.settings.openai_api_key)

            stream = await client.chat.completions.create(
                model=self.settings.openai_model,
                messages=messages,
                temperature=0.7,
                stream=True,
            )

            async for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content

            logger.info("Streaming contextual chat completed successfully")

        except Exception as e:
            logger.error(f"Streaming contextual chat error: {e}")
            raise

    def health_check(self) -> bool:
        """Check database connectivity."""
        try:
            self._init_engine()
            with self._engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return True
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return False


# Singleton instance
_engine_instance: Optional[CRMQueryEngine] = None


def get_crm_engine() -> CRMQueryEngine:
    """Get or create the CRM query engine singleton."""
    global _engine_instance
    if _engine_instance is None:
        _engine_instance = CRMQueryEngine()
    return _engine_instance
