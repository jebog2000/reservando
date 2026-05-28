import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.printer_settings import Printer_settingsService
from dependencies.auth import get_current_user
from schemas.auth import UserResponse

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/printer_settings", tags=["printer_settings"])


# ---------- Pydantic Schemas ----------
class Printer_settingsData(BaseModel):
    """Entity data schema (for create/update)"""
    printer_type: str
    printer_name: str
    printnode_api_key: str = None
    printnode_printer_id: str = None
    paper_width: int = None
    is_default: bool = None


class Printer_settingsUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    printer_type: Optional[str] = None
    printer_name: Optional[str] = None
    printnode_api_key: Optional[str] = None
    printnode_printer_id: Optional[str] = None
    paper_width: Optional[int] = None
    is_default: Optional[bool] = None


class Printer_settingsResponse(BaseModel):
    """Entity response schema"""
    id: int
    user_id: str
    printer_type: str
    printer_name: str
    printnode_api_key: Optional[str] = None
    printnode_printer_id: Optional[str] = None
    paper_width: Optional[int] = None
    is_default: Optional[bool] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Printer_settingsListResponse(BaseModel):
    """List response schema"""
    items: List[Printer_settingsResponse]
    total: int
    skip: int
    limit: int


class Printer_settingsBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[Printer_settingsData]


class Printer_settingsBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: Printer_settingsUpdateData


class Printer_settingsBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[Printer_settingsBatchUpdateItem]


class Printer_settingsBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=Printer_settingsListResponse)
async def query_printer_settingss(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Query printer_settingss with filtering, sorting, and pagination (user can only see their own records)"""
    logger.debug(f"Querying printer_settingss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = Printer_settingsService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")
        
        result = await service.get_list(
            skip=skip, 
            limit=limit,
            query_dict=query_dict,
            sort=sort,
            user_id=str(current_user.id),
        )
        logger.debug(f"Found {result['total']} printer_settingss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying printer_settingss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=Printer_settingsListResponse)
async def query_printer_settingss_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query printer_settingss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying printer_settingss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = Printer_settingsService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")

        result = await service.get_list(
            skip=skip,
            limit=limit,
            query_dict=query_dict,
            sort=sort
        )
        logger.debug(f"Found {result['total']} printer_settingss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying printer_settingss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=Printer_settingsResponse)
async def get_printer_settings(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single printer_settings by ID (user can only see their own records)"""
    logger.debug(f"Fetching printer_settings with id: {id}, fields={fields}")
    
    service = Printer_settingsService(db)
    try:
        result = await service.get_by_id(id, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Printer_settings with id {id} not found")
            raise HTTPException(status_code=404, detail="Printer_settings not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching printer_settings {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=Printer_settingsResponse, status_code=201)
async def create_printer_settings(
    data: Printer_settingsData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new printer_settings"""
    logger.debug(f"Creating new printer_settings with data: {data}")
    
    service = Printer_settingsService(db)
    try:
        result = await service.create(data.model_dump(), user_id=str(current_user.id))
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create printer_settings")
        
        logger.info(f"Printer_settings created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating printer_settings: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating printer_settings: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[Printer_settingsResponse], status_code=201)
async def create_printer_settingss_batch(
    request: Printer_settingsBatchCreateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create multiple printer_settingss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} printer_settingss")
    
    service = Printer_settingsService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump(), user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} printer_settingss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[Printer_settingsResponse])
async def update_printer_settingss_batch(
    request: Printer_settingsBatchUpdateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update multiple printer_settingss in a single request (requires ownership)"""
    logger.debug(f"Batch updating {len(request.items)} printer_settingss")
    
    service = Printer_settingsService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict, user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} printer_settingss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=Printer_settingsResponse)
async def update_printer_settings(
    id: int,
    data: Printer_settingsUpdateData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing printer_settings (requires ownership)"""
    logger.debug(f"Updating printer_settings {id} with data: {data}")

    service = Printer_settingsService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Printer_settings with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Printer_settings not found")
        
        logger.info(f"Printer_settings {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating printer_settings {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating printer_settings {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_printer_settingss_batch(
    request: Printer_settingsBatchDeleteRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple printer_settingss by their IDs (requires ownership)"""
    logger.debug(f"Batch deleting {len(request.ids)} printer_settingss")
    
    service = Printer_settingsService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id, user_id=str(current_user.id))
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} printer_settingss successfully")
        return {"message": f"Successfully deleted {deleted_count} printer_settingss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_printer_settings(
    id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a single printer_settings by ID (requires ownership)"""
    logger.debug(f"Deleting printer_settings with id: {id}")
    
    service = Printer_settingsService(db)
    try:
        success = await service.delete(id, user_id=str(current_user.id))
        if not success:
            logger.warning(f"Printer_settings with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Printer_settings not found")
        
        logger.info(f"Printer_settings {id} deleted successfully")
        return {"message": "Printer_settings deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting printer_settings {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")