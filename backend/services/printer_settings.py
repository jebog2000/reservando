import logging
from typing import Optional, Dict, Any, List

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.printer_settings import Printer_settings

logger = logging.getLogger(__name__)


# ------------------ Service Layer ------------------
class Printer_settingsService:
    """Service layer for Printer_settings operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: Dict[str, Any], user_id: Optional[str] = None) -> Optional[Printer_settings]:
        """Create a new printer_settings"""
        try:
            if user_id:
                data['user_id'] = user_id
            obj = Printer_settings(**data)
            self.db.add(obj)
            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Created printer_settings with id: {obj.id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error creating printer_settings: {str(e)}")
            raise

    async def check_ownership(self, obj_id: int, user_id: str) -> bool:
        """Check if user owns this record"""
        try:
            obj = await self.get_by_id(obj_id, user_id=user_id)
            return obj is not None
        except Exception as e:
            logger.error(f"Error checking ownership for printer_settings {obj_id}: {str(e)}")
            return False

    async def get_by_id(self, obj_id: int, user_id: Optional[str] = None) -> Optional[Printer_settings]:
        """Get printer_settings by ID (user can only see their own records)"""
        try:
            query = select(Printer_settings).where(Printer_settings.id == obj_id)
            if user_id:
                query = query.where(Printer_settings.user_id == user_id)
            result = await self.db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching printer_settings {obj_id}: {str(e)}")
            raise

    async def get_list(
        self, 
        skip: int = 0, 
        limit: int = 20, 
        user_id: Optional[str] = None,
        query_dict: Optional[Dict[str, Any]] = None,
        sort: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get paginated list of printer_settingss (user can only see their own records)"""
        try:
            query = select(Printer_settings)
            count_query = select(func.count(Printer_settings.id))
            
            if user_id:
                query = query.where(Printer_settings.user_id == user_id)
                count_query = count_query.where(Printer_settings.user_id == user_id)
            
            if query_dict:
                for field, value in query_dict.items():
                    if hasattr(Printer_settings, field):
                        query = query.where(getattr(Printer_settings, field) == value)
                        count_query = count_query.where(getattr(Printer_settings, field) == value)
            
            count_result = await self.db.execute(count_query)
            total = count_result.scalar()

            if sort:
                if sort.startswith('-'):
                    field_name = sort[1:]
                    if hasattr(Printer_settings, field_name):
                        query = query.order_by(getattr(Printer_settings, field_name).desc())
                else:
                    if hasattr(Printer_settings, sort):
                        query = query.order_by(getattr(Printer_settings, sort))
            else:
                query = query.order_by(Printer_settings.id.desc())

            result = await self.db.execute(query.offset(skip).limit(limit))
            items = result.scalars().all()

            return {
                "items": items,
                "total": total,
                "skip": skip,
                "limit": limit,
            }
        except Exception as e:
            logger.error(f"Error fetching printer_settings list: {str(e)}")
            raise

    async def update(self, obj_id: int, update_data: Dict[str, Any], user_id: Optional[str] = None) -> Optional[Printer_settings]:
        """Update printer_settings (requires ownership)"""
        try:
            obj = await self.get_by_id(obj_id, user_id=user_id)
            if not obj:
                logger.warning(f"Printer_settings {obj_id} not found for update")
                return None
            for key, value in update_data.items():
                if hasattr(obj, key) and key != 'user_id':
                    setattr(obj, key, value)

            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Updated printer_settings {obj_id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error updating printer_settings {obj_id}: {str(e)}")
            raise

    async def delete(self, obj_id: int, user_id: Optional[str] = None) -> bool:
        """Delete printer_settings (requires ownership)"""
        try:
            obj = await self.get_by_id(obj_id, user_id=user_id)
            if not obj:
                logger.warning(f"Printer_settings {obj_id} not found for deletion")
                return False
            await self.db.delete(obj)
            await self.db.commit()
            logger.info(f"Deleted printer_settings {obj_id}")
            return True
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error deleting printer_settings {obj_id}: {str(e)}")
            raise

    async def get_by_field(self, field_name: str, field_value: Any) -> Optional[Printer_settings]:
        """Get printer_settings by any field"""
        try:
            if not hasattr(Printer_settings, field_name):
                raise ValueError(f"Field {field_name} does not exist on Printer_settings")
            result = await self.db.execute(
                select(Printer_settings).where(getattr(Printer_settings, field_name) == field_value)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching printer_settings by {field_name}: {str(e)}")
            raise

    async def list_by_field(
        self, field_name: str, field_value: Any, skip: int = 0, limit: int = 20
    ) -> List[Printer_settings]:
        """Get list of printer_settingss filtered by field"""
        try:
            if not hasattr(Printer_settings, field_name):
                raise ValueError(f"Field {field_name} does not exist on Printer_settings")
            result = await self.db.execute(
                select(Printer_settings)
                .where(getattr(Printer_settings, field_name) == field_value)
                .offset(skip)
                .limit(limit)
                .order_by(Printer_settings.id.desc())
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error fetching printer_settingss by {field_name}: {str(e)}")
            raise