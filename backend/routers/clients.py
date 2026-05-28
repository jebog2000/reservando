import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.clients import ClientsService

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/clients", tags=["clients"])


# ---------- Pydantic Schemas ----------
class ClientsData(BaseModel):
    """Entity data schema (for create/update)"""
    name: str
    phone: str
    email: str = None
    notes: str = None


class ClientsUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None


class ClientsResponse(BaseModel):
    """Entity response schema"""
    id: int
    name: str
    phone: str
    email: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ClientsListResponse(BaseModel):
    """List response schema"""
    items: List[ClientsResponse]
    total: int
    skip: int
    limit: int


class ClientsBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[ClientsData]


class ClientsBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: ClientsUpdateData


class ClientsBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[ClientsBatchUpdateItem]


class ClientsBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=ClientsListResponse)
async def query_clientss(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Query clientss with filtering, sorting, and pagination"""
    logger.debug(f"Querying clientss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = ClientsService(db)
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
        logger.debug(f"Found {result['total']} clientss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying clientss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=ClientsListResponse)
async def query_clientss_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query clientss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying clientss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = ClientsService(db)
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
        logger.debug(f"Found {result['total']} clientss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying clientss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all/{id}", response_model=ClientsResponse)
async def get_clients_all(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Get a single clients by ID without user restriction"""
    logger.debug(f"Fetching clients (all) with id: {id}, fields={fields}")

    service = ClientsService(db)
    try:
        result = await service.get_by_id(id)
        if not result:
            logger.warning(f"Clients with id {id} not found")
            raise HTTPException(status_code=404, detail="Clients not found")

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching clients {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.put("/all/{id}", response_model=ClientsResponse)
async def update_clients_all(
    id: int,
    data: ClientsUpdateData,
    db: AsyncSession = Depends(get_db),
):
    """Update an existing clients without user restriction"""
    logger.debug(f"Updating clients (all) {id} with data: {data}")

    service = ClientsService(db)
    try:
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict)
        if not result:
            logger.warning(f"Clients with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Clients not found")

        logger.info(f"Clients {id} updated successfully (all)")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating clients {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating clients {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=ClientsResponse)
async def get_clients(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Get a single clients by ID"""
    logger.debug(f"Fetching clients with id: {id}, fields={fields}")
    
    service = ClientsService(db)
    try:
        result = await service.get_by_id(id)
        if not result:
            logger.warning(f"Clients with id {id} not found")
            raise HTTPException(status_code=404, detail="Clients not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching clients {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=ClientsResponse, status_code=201)
async def create_clients(
    data: ClientsData,
    db: AsyncSession = Depends(get_db),
):
    """Create a new clients"""
    logger.debug(f"Creating new clients with data: {data}")
    
    service = ClientsService(db)
    try:
        result = await service.create(data.model_dump())
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create clients")
        
        logger.info(f"Clients created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating clients: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating clients: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[ClientsResponse], status_code=201)
async def create_clientss_batch(
    request: ClientsBatchCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create multiple clientss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} clientss")
    
    service = ClientsService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump())
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} clientss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[ClientsResponse])
async def update_clientss_batch(
    request: ClientsBatchUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update multiple clientss in a single request"""
    logger.debug(f"Batch updating {len(request.items)} clientss")
    
    service = ClientsService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict)
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} clientss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=ClientsResponse)
async def update_clients(
    id: int,
    data: ClientsUpdateData,
    db: AsyncSession = Depends(get_db),
):
    """Update an existing clients"""
    logger.debug(f"Updating clients {id} with data: {data}")

    service = ClientsService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict)
        if not result:
            logger.warning(f"Clients with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Clients not found")
        
        logger.info(f"Clients {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating clients {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating clients {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_clientss_batch(
    request: ClientsBatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple clientss by their IDs"""
    logger.debug(f"Batch deleting {len(request.ids)} clientss")
    
    service = ClientsService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id)
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} clientss successfully")
        return {"message": f"Successfully deleted {deleted_count} clientss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_clients(
    id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a single clients by ID"""
    logger.debug(f"Deleting clients with id: {id}")
    
    service = ClientsService(db)
    try:
        success = await service.delete(id)
        if not success:
            logger.warning(f"Clients with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Clients not found")
        
        logger.info(f"Clients {id} deleted successfully")
        return {"message": "Clients deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting clients {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")