import logging
from datetime import date as date_type
from typing import Optional, Dict, Any, List

from sqlalchemy import select, func, cast, String, Date, Integer
from sqlalchemy.ext.asyncio import AsyncSession

from models.clients import Clients

logger = logging.getLogger(__name__)


def _coerce_value(col, value):
    """Coerce a string value to the appropriate Python type based on column type."""
    try:
        col_type = col.property.columns[0].type
    except (AttributeError, IndexError):
        return value

    if isinstance(col_type, Date) and isinstance(value, str):
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
    """Parse query dict with support for __gte, __lte, __contains suffixes."""
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
class ClientsService:
    """Service layer for Clients operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: Dict[str, Any]) -> Optional[Clients]:
        """Create a new clients"""
        try:
            obj = Clients(**data)
            self.db.add(obj)
            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Created clients with id: {obj.id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error creating clients: {str(e)}")
            raise

    async def get_by_id(self, obj_id: int) -> Optional[Clients]:
        """Get clients by ID"""
        try:
            query = select(Clients).where(Clients.id == obj_id)
            result = await self.db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching clients {obj_id}: {str(e)}")
            raise

    async def get_list(
        self, 
        skip: int = 0, 
        limit: int = 20, 
        query_dict: Optional[Dict[str, Any]] = None,
        sort: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get paginated list of clientss"""
        try:
            query = select(Clients)
            count_query = select(func.count(Clients.id))
            
            # Apply filters with __gte, __lte, __contains support
            conditions = _parse_query_filters(Clients, query_dict)
            for condition in conditions:
                query = query.where(condition)
                count_query = count_query.where(condition)
            
            count_result = await self.db.execute(count_query)
            total = count_result.scalar()

            if sort:
                if sort.startswith('-'):
                    field_name = sort[1:]
                    if hasattr(Clients, field_name):
                        query = query.order_by(getattr(Clients, field_name).desc())
                else:
                    if hasattr(Clients, sort):
                        query = query.order_by(getattr(Clients, sort))
            else:
                query = query.order_by(Clients.id.desc())

            result = await self.db.execute(query.offset(skip).limit(limit))
            items = result.scalars().all()

            return {
                "items": items,
                "total": total,
                "skip": skip,
                "limit": limit,
            }
        except Exception as e:
            logger.error(f"Error fetching clients list: {str(e)}")
            raise

    async def update(self, obj_id: int, update_data: Dict[str, Any]) -> Optional[Clients]:
        """Update clients"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Clients {obj_id} not found for update")
                return None
            for key, value in update_data.items():
                if hasattr(obj, key):
                    setattr(obj, key, value)

            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Updated clients {obj_id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error updating clients {obj_id}: {str(e)}")
            raise

    async def delete(self, obj_id: int) -> bool:
        """Delete clients"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Clients {obj_id} not found for deletion")
                return False
            await self.db.delete(obj)
            await self.db.commit()
            logger.info(f"Deleted clients {obj_id}")
            return True
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error deleting clients {obj_id}: {str(e)}")
            raise

    async def get_by_field(self, field_name: str, field_value: Any) -> Optional[Clients]:
        """Get clients by any field"""
        try:
            if not hasattr(Clients, field_name):
                raise ValueError(f"Field {field_name} does not exist on Clients")
            result = await self.db.execute(
                select(Clients).where(getattr(Clients, field_name) == field_value)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching clients by {field_name}: {str(e)}")
            raise

    async def list_by_field(
        self, field_name: str, field_value: Any, skip: int = 0, limit: int = 20
    ) -> List[Clients]:
        """Get list of clientss filtered by field"""
        try:
            if not hasattr(Clients, field_name):
                raise ValueError(f"Field {field_name} does not exist on Clients")
            result = await self.db.execute(
                select(Clients)
                .where(getattr(Clients, field_name) == field_value)
                .offset(skip)
                .limit(limit)
                .order_by(Clients.id.desc())
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error fetching clientss by {field_name}: {str(e)}")
            raise