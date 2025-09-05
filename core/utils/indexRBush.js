import RBush from 'rbush';

class IndexRBush {
    _rtree = new RBush();

    add(shape) {
        const [minX, minY, maxX, maxY] = shape.getBoundingBox();
        const item = {
            minX, minY, maxX, maxY,
            shape,
        }
        this._rtree.insert(item);
        return item;
    }

    remove(shape) {
        this._rtree.remove({
            shape,
        }, (a, b) => {
            return a.shape === b.shape;
        })
    }

    refresh(shape) {
        this.remove(shape);
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