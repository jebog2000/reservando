import logging
from typing import Optional, Dict, Any, List

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.salons import Salons

logger = logging.getLogger(__name__)


# ------------------ Service Layer ------------------
class SalonsService:
    """Service layer for Salons operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: Dict[str, Any], user_id: str = None) -> Optional[Salons]:
        """Create a new salons"""
        try:
            if user_id:
                data["user_id"] = user_id
            obj = Salons(**data)
            self.db.add(obj)
            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Created salons with id: {obj.id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error creating salons: {str(e)}")
            raise

    async def get_by_id(self, obj_id: int) -> Optional[Salons]:
        """Get salons by ID"""
        try:
            query = select(Salons).where(Salons.id == obj_id)
            result = await self.db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching salons {obj_id}: {str(e)}")
            raise

    async def get_list(
        self, 
        skip: int = 0, 
        limit: int = 20, 
        query_dict: Optional[Dict[str, Any]] = None,
        sort: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get paginated list of salonss"""
        try:
            query = select(Salons)
            count_query = select(func.count(Salons.id))
            
            if query_dict:
                for field, value in query_dict.items():
                    if hasattr(Salons, field):
                        query = query.where(getattr(Salons, field) == value)
                        count_query = count_query.where(getattr(Salons, field) == value)
            
            count_result = await self.db.execute(count_query)
            total = count_result.scalar()

            if sort:
                if sort.startswith('-'):
                    field_name = sort[1:]
                    if hasattr(Salons, field_name):
                        query = query.order_by(getattr(Salons, field_name).desc())
                else:
                    if hasattr(Salons, sort):
                        query = query.order_by(getattr(Salons, sort))
            else:
                query = query.order_by(Salons.id.desc())

            result = await self.db.execute(query.offset(skip).limit(limit))
            items = result.scalars().all()

            return {
                "items": items,
                "total": total,
                "skip": skip,
                "limit": limit,
            }
        except Exception as e:
            logger.error(f"Error fetching salons list: {str(e)}")
            raise

    async def update(self, obj_id: int, update_data: Dict[str, Any]) -> Optional[Salons]:
        """Update salons"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Salons {obj_id} not found for update")
                return None
            for key, value in update_data.items():
                if hasattr(obj, key):
                    setattr(obj, key, value)

            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Updated salons {obj_id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error updating salons {obj_id}: {str(e)}")
            raise

    async def delete(self, obj_id: int) -> bool:
        """Delete salons"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Salons {obj_id} not found for deletion")
                return False
            await self.db.delete(obj)
            await self.db.commit()
            logger.info(f"Deleted salons {obj_id}")
            return True
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error deleting salons {obj_id}: {str(e)}")
            raise

    async def get_by_field(self, field_name: str, field_value: Any) -> Optional[Salons]:
        """Get salons by any field"""
        try:
            if not hasattr(Salons, field_name):
                raise ValueError(f"Field {field_name} does not exist on Salons")
            result = await self.db.execute(
                select(Salons).where(getattr(Salons, field_name) == field_value)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching salons by {field_name}: {str(e)}")
            raise

    async def list_by_field(
        self, field_name: str, field_value: Any, skip: int = 0, limit: int = 20
    ) -> List[Salons]:
        """Get list of salonss filtered by field"""
        try:
            if not hasattr(Salons, field_name):
                raise ValueError(f"Field {field_name} does not exist on Salons")
            result = await self.db.execute(
                select(Salons)
                .where(getattr(Salons, field_name) == field_value)
                .offset(skip)
                .limit(limit)
                .order_by(Salons.id.desc())
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error fetching salonss by {field_name}: {str(e)}")
            raise