from core.database import Base
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Integer, String


class Printer_settings(Base):
    __tablename__ = "printer_settings"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False)
    printer_type = Column(String, nullable=False)
    printer_name = Column(String, nullable=False)
    printnode_api_key = Column(String, nullable=True)
    printnode_printer_id = Column(String, nullable=True)
    paper_width = Column(Integer, nullable=True)
    is_default = Column(Boolean, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)