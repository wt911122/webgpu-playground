import RBush from 'rbush';

class IndexRBush {
    _rtree = new RBush();

    add(shape) {
        this.remove(shape);
        this._rtree.insert(shape.getBoundingBoxForRbush());
    }

    remove(shape) {
        this._rtree.remove(shape.getBoundingBoxForRbush())
    }

    refresh(shape) {
        this.add(shape);   
    }
    
    inBound([minX, minY, maxX, maxY]) {
        const shapesInViewport = this._rtree
            .search({ minX, minY, maxX, maxY })
            .map((bush) => bush.shape);
        
        return shapesInViewport;
    }

    preHitTest(bound) {
        const shapes = this.inBound(bound);
        return shapes.sort((a, b) => a._zIndex - b._zIndex)
    }

    destroy() {
        this._rtree.clear();
    }
}

export default IndexRBush;