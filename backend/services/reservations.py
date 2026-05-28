import logging
from datetime import date as date_type
from typing import Optional, Dict, Any, List

from sqlalchemy import select, func, cast, String, Date, Integer
from sqlalchemy.ext.asyncio import AsyncSession

from models.reservations import Reservations

logger = logging.getLogger(__name__)


def _coerce_value(col, value):
    """Coerce a string value to the appropriate Python type based on column type."""
    try:
        col_type = col.property.columns[0].type
    except (AttributeError, IndexError):
        return value

    if isinstance(col_type, Date) and isinstance(value, str):
        # Parse date string to date object
        try:
            return date_type.fromisoformat(value)
        except ValueError:
            return value
    elif isinstance(col_type, Integer) and isinstance(value, str):
        try:
            return int(value)
        except ValueError:
            return value
    return value


def _parse_query_filters(model_class, query_dict: Dict[str, Any]):
    """Parse query dict with support for __gte, __lte, __contains suffixes.
    
    Returns a list of SQLAlchemy filter conditions.
    """
    filters = []
    if not query_dict:
        return filters

    for key, value in query_dict.items():
        if key.endswith('__gte'):
            field_name = key[:-5]
            if hasattr(model_class, field_name):
                col = getattr(model_class, field_name)
                coerced = _coerce_value(col, value)
                filters.append(col >= coerced)
        elif key.endswith('__lte'):
            field_name = key[:-5]
            if hasattr(model_class, field_name):
                col = getattr(model_class, field_name)
                coerced = _coerce_value(col, value)
                filters.append(col <= coerced)
        elif key.endswith('__contains'):
            field_name = key[:-10]
            if hasattr(model_class, field_name):
                col = getattr(model_class, field_name)
                filters.append(cast(col, String).ilike(f"%{value}%"))
        else:
            if hasattr(model_class, key):
                col = getattr(model_class, key)
                coerced = _coerce_value(col, value)
                filters.append(col == coerced)

    return filters


# ------------------ Service Layer ------------------
class ReservationsService:
    """Service layer for Reservations operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: Dict[str, Any], user_id: Optional[str] = None) -> Optional[Reservations]:
        """Create a new reservations"""
        try:
            if user_id:
                data['user_id'] = user_id
            obj = Reservations(**data)
            self.db.add(obj)
            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Created reservations with id: {obj.id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error creating reservations: {str(e)}")
            raise

    async def check_ownership(self, obj_id: int, user_id: str) -> bool:
        """Check if user owns this record"""
        try:
            obj = await self.get_by_id(obj_id, user_id=user_id)
            return obj is not None
        except Exception as e:
            logger.error(f"Error checking ownership for reservations {obj_id}: {str(e)}")
            return False

    async def get_by_id(self, obj_id: int, user_id: Optional[str] = None) -> Optional[Reservations]:
        """Get reservations by ID (user can only see their own records)"""
        try:
            query = select(Reservations).where(Reservations.id == obj_id)
            if user_id:
                query = query.where(Reservations.user_id == user_id)
            result = await self.db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching reservations {obj_id}: {str(e)}")
            raise

    async def get_list(
        self, 
        skip: int = 0, 
        limit: int = 20, 
        user_id: Optional[str] = None,
        query_dict: Optional[Dict[str, Any]] = None,
        sort: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get paginated list of reservationss (user can only see their own records)"""
        try:
            query = select(Reservations)
            count_query = select(func.count(Reservations.id))
            
            if user_id:
                query = query.where(Reservations.user_id == user_id)
                count_query = count_query.where(Reservations.user_id == user_id)
            
            # Apply filters with __gte, __lte, __contains support
            conditions = _parse_query_filters(Reservations, query_dict)
            for condition in conditions:
                query = query.where(condition)
                count_query = count_query.where(condition)
            
            count_result = await self.db.execute(count_query)
            total = count_result.scalar()

            if sort:
                if sort.startswith('-'):
                    field_name = sort[1:]
                    if hasattr(Reservations, field_name):
                        query = query.order_by(getattr(Reservations, field_name).desc())
                else:
                    if hasattr(Reservations, sort):
                        query = query.order_by(getattr(Reservations, sort))
            else:
                query = query.order_by(Reservations.id.desc())

            result = await self.db.execute(query.offset(skip).limit(limit))
            items = result.scalars().all()

            return {
                "items": items,
                "total": total,
                "skip": skip,
                "limit": limit,
            }
        except Exception as e:
            logger.error(f"Error fetching reservations list: {str(e)}")
            raise

    async def update(self, obj_id: int, update_data: Dict[str, Any], user_id: Optional[str] = None) -> Optional[Reservations]:
        """Update reservations (requires ownership)"""
        try:
            obj = await self.get_by_id(obj_id, user_id=user_id)
            if not obj:
                logger.warning(f"Reservations {obj_id} not found for update")
                return None
            for key, value in update_data.items():
                if hasattr(obj, key) and key != 'user_id':
                    setattr(obj, key, value)

            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Updated reservations {obj_id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error updating reservations {obj_id}: {str(e)}")
            raise

    async def delete(self, obj_id: int, user_id: Optional[str] = None) -> bool:
        """Delete reservations (requires ownership)"""
        try:
            obj = await self.get_by_id(obj_id, user_id=user_id)
            if not obj:
                logger.warning(f"Reservations {obj_id} not found for deletion")
                return False
            await self.db.delete(obj)
            await self.db.commit()
            logger.info(f"Deleted reservations {obj_id}")
            return True
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error deleting reservations {obj_id}: {str(e)}")
            raise

    async def get_by_field(self, field_name: str, field_value: Any) -> Optional[Reservations]:
        """Get reservations by any field"""
        try:
            if not hasattr(Reservations, field_name):
                raise ValueError(f"Field {field_name} does not exist on Reservations")
            result = await self.db.execute(
                select(Reservations).where(getattr(Reservations, field_name) == field_value)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching reservations by {field_name}: {str(e)}")
            raise

    async def list_by_field(
        self, field_name: str, field_value: Any, skip: int = 0, limit: int = 20
    ) -> List[Reservations]:
        """Get list of reservationss filtered by field"""
        try:
            if not hasattr(Reservations, field_name):
                raise ValueError(f"Field {field_name} does not exist on Reservations")
            result = await self.db.execute(
                select(Reservations)
                .where(getattr(Reservations, field_name) == field_value)
                .offset(skip)
                .limit(limit)
                .order_by(Reservations.id.desc())
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error fetching reservationss by {field_name}: {str(e)}")
            raise