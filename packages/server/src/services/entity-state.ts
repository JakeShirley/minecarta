import type { Entity, Dimension } from '@minecraft-map/shared';

/**
 * In-memory entity state service
 */
export class EntityStateService {
    private readonly entities: Map<string, Entity> = new Map();

    /**
     * Update or add an entity
     */
    updateEntity(entity: Entity): Entity {
        this.entities.set(entity.id, entity);
        return entity;
    }

    /**
     * Update multiple entities
     */
    updateEntities(entities: Entity[]): void {
        for (const entity of entities) {
            this.entities.set(entity.id, entity);
        }
    }

    /**
     * Remove an entity
     */
    removeEntity(id: string): boolean {
        return this.entities.delete(id);
    }

    /**
     * Get an entity by ID
     */
    getEntity(id: string): Entity | undefined {
        return this.entities.get(id);
    }

    /**
     * Get all entities
     */
    getAllEntities(): Entity[] {
        return Array.from(this.entities.values());
    }

    /**
     * Get entities in a specific dimension
     */
    getEntitiesByDimension(dimension: Dimension): Entity[] {
        return this.getAllEntities().filter(e => e.dimension === dimension);
    }

    /**
     * Get entities by type
     */
    getEntitiesByType(type: string): Entity[] {
        return this.getAllEntities().filter(e => e.type === type);
    }

    /**
     * Get the number of entities
     */
    getEntityCount(): number {
        return this.entities.size;
    }

    /**
     * Clear all entities
     */
    clear(): void {
        this.entities.clear();
    }
}

// Singleton instance
let _entityStateService: EntityStateService | null = null;

export function getEntityStateService(): EntityStateService {
    if (!_entityStateService) {
        _entityStateService = new EntityStateService();
    }
    return _entityStateService;
}
