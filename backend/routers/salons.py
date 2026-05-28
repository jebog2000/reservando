import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.salons import SalonsService
from dependencies.auth import get_current_user
from schemas.auth import UserResponse

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/salons", tags=["salons"])


# ---------- Pydantic Schemas ----------
class SalonsData(BaseModel):
    """Entity data schema (for create/update)"""
    name: str
    capacity: int = None
    description: str = None
    active: bool = None


class SalonsUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    name: Optional[str] = None
    capacity: Optional[int] = None
    description: Optional[str] = None
    active: Optional[bool] = None


class SalonsResponse(BaseModel):
    """Entity response schema"""
    id: int
    user_id: str
    name: str
    capacity: Optional[int] = None
    description: Optional[str] = None
    active: Optional[bool] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SalonsListResponse(BaseModel):
    """List response schema"""
    items: List[SalonsResponse]
    total: int
    skip: int
    limit: int


class SalonsBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[SalonsData]


class SalonsBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: SalonsUpdateData


class SalonsBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[SalonsBatchUpdateItem]


class SalonsBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=SalonsListResponse)
async def query_salonss(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Query salonss with filtering, sorting, and pagination"""
    logger.debug(f"Querying salonss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = SalonsService(db)
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
        )
        logger.debug(f"Found {result['total']} salonss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying salonss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=SalonsListResponse)
async def query_salonss_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query salonss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying salonss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = SalonsService(db)
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
        logger.debug(f"Found {result['total']} salonss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying salonss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=SalonsResponse)
async def get_salons(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single salons by ID"""
    logger.debug(f"Fetching salons with id: {id}, fields={fields}")
    
    service = SalonsService(db)
    try:
        result = await service.get_by_id(id)
        if not result:
            logger.warning(f"Salons with id {id} not found")
            raise HTTPException(status_code=404, detail="Salons not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching salons {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=SalonsResponse, status_code=201)
async def create_salons(
    data: SalonsData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new salons"""
    logger.debug(f"Creating new salons with data: {data}")
    
    service = SalonsService(db)
    try:
        result = await service.create(data.model_dump(), user_id=str(current_user.id))
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create salons")
        
        logger.info(f"Salons created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating salons: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating salons: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[SalonsResponse], status_code=201)
async def create_salonss_batch(
    request: SalonsBatchCreateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create multiple salonss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} salonss")
    
    service = SalonsService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump(), user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} salonss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[SalonsResponse])
async def update_salonss_batch(
    request: SalonsBatchUpdateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update multiple salonss in a single request"""
    logger.debug(f"Batch updating {len(request.items)} salonss")
    
    service = SalonsService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict)
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} salonss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=SalonsResponse)
async def update_salons(
    id: int,
    data: SalonsUpdateData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing salons"""
    logger.debug(f"Updating salons {id} with data: {data}")

    service = SalonsService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict)
        if not result:
            logger.warning(f"Salons with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Salons not found")
        
        logger.info(f"Salons {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating salons {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating salons {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_salonss_batch(
    request: SalonsBatchDeleteRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple salonss by their IDs"""
    logger.debug(f"Batch deleting {len(request.ids)} salonss")
    
    service = SalonsService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id)
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} salonss successfully")
        return {"message": f"Successfully deleted {deleted_count} salonss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_salons(
    id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a single salons by ID"""
    logger.debug(f"Deleting salons with id: {id}")
    
    service = SalonsService(db)
    try:
        success = await service.delete(id)
        if not success:
            logger.warning(f"Salons with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Salons not found")
        
        logger.info(f"Salons {id} deleted successfully")
        return {"message": "Salons deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting salons {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")