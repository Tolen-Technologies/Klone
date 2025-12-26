"""LlamaIndex NLSQLTableQueryEngine implementation for CRM queries."""

import logging
from typing import Optional
from urllib.parse import quote_plus

from sqlalchemy import create_engine, text
from llama_index.core import SQLDatabase, PromptTemplate
from llama_index.core.query_engine import NLSQLTableQueryEngine
from llama_index.llms.openai import OpenAI

from .config import Settings, get_settings
from .prompts import TEXT_TO_SQL_PROMPT, SEGMENT_GENERATION_PROMPT

logger = logging.getLogger(__name__)


class CRMQueryEngine:
    """CRM Query Engine using LlamaIndex NLSQLTableQueryEngine."""

    def __init__(self, settings: Optional[Settings] = None):
        self.settings = settings or get_settings()
        self._engine = None
        self._sql_database = None
        self._query_engine = None
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
