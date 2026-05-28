from core.database import Base
from datetime import datetime
from sqlalchemy import Column, Date, DateTime, Integer, String


class Reservations(Base):
    __tablename__ = "reservations"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False)
    client_name = Column(String, nullable=False)
    client_phone = Column(String, nullable=True)
    client_email = Column(String, nullable=True)
    reservation_date = Column(Date, nullable=False)
    reservation_time = Column(String, nullable=False)
    party_size = Column(Integer, nullable=False)
    salon = Column(String, nullable=False)
    notes = Column(String, nullable=True)
    status = Column(String, nullable=False)
    preference = Column(String, nullable=True)
    calendar_event_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)