import { mat3, vec2 } from 'gl-matrix';
function SelectBox() {
    const _parts_ = {
        root: null,
        boundary: null,
        cpA: null,
        cpB: null,
        cpC: null,
        cpD: null,
    }

    const target = {
        shape: null,
        cpDragging: false,
    }


    function _render(shape) {
        target.shape = shape;
        const [a, b, c, d] = shape.getBoundingBox();
        const {
            root,
            boundary,
            cpA,
            cpB,
            cpC,
            cpD,
        } = _parts_;

        boundary.path = `M${a} ${b}L${c} ${b}L${c} ${d}L${a} ${d}Z`,
        cpA.setTranslate(a, b);
        cpB.setTranslate(c, b);
        cpC.setTranslate(c, d);
        cpD.setTranslate(a, d);
        boundary.visible = true;
        cpA.visible = true;
        cpB.visible = true;
        cpC.visible = true;
        cpD.visible = true;
        root.updateWorldMatrix();
    }

    function _hide(temporary) {
        const {
            boundary,
            cpA,
            cpB,
            cpC,
            cpD,
        } = _parts_;
        boundary.visible = false;
        cpA.visible = false;
        cpB.visible = false;
        cpC.visible = false;
        cpD.visible = false;
        if(!temporary) {
            target.shape = null;
        }   
    }

    function _cpHandler(cp, dir) {
        const tempVec = vec2.create();
        const context = {
            cp: dir,
            fx: 0,
            fy: 0,
            vecf: vec2.create(),
            tx: 0,
            ty: 0,
            vect: vec2.create()
        }
        cp.addEventListener('mouseenter', () =>{
            cp.fill = 'blue';
        })
         cp.addEventListener('mouseleave', () =>{
            cp.fill = 'white';
        })
        cp.addEventListener('dragstart', (e) => {
            e.preventDefault();
            const parent = target.shape.parent;
            vec2.transformMat3(context.vecf, 
                vec2.set(tempVec, e.detail.canvasX, e.detail.canvasY), 
                parent.matrix);

            Object.assign(context, {
                fx: e.detail.canvasX,
                fy: e.detail.canvasY,
                tx: 0,
                ty: 0,
            })
            const shape = target.shape;
            shape.editBoundaryStart(context);
            target.cpDragging = true;
        })
        cp.addEventListener('dragging', (e) => {
            context.tx = e.detail.canvasX;
            context.ty = e.detail.canvasY;
            const parent = target.shape.parent;
            vec2.transformMat3(context.vect, 
                vec2.set(tempVec, e.detail.canvasX, e.detail.canvasY), 
                parent.matrix);

            const shape = target.shape;
            shape.editBoundary(context);
            _render(shape)
        })
        cp.addEventListener('dragend', (e) => {
            const shape = target.shape;
            shape.editBoundaryEnd(context);
            target.cpDragging = false;
        })
        
    }

    function setup(context) {
        const jc = context.jcanvas;
        const Path = jc.getShapeCtor('Path');
        const Ellipse = jc.getShapeCtor('Ellipse');
        const Group = jc.getShapeCtor('Group');
        const root = Group();
        const visible = false;
        const boundary = Path({
            path: '',
            stroke: 'blue',
            strokeWidth: 1,
            visible,
        })
        boundary.checkHit = () => false;
        const [a, b, c, d] = [0,0,0,0];
        const cpA = Ellipse({
            cx: a, cy: b,
            width: 12, height: 12,
            fill: 'white',
            stroke: 'blue',
            strokeWidth: 1,
            visible
        });
        const cpB = Ellipse({
            cx: c, cy: b,
             width: 12, height: 12,
            fill: 'white',
            stroke: 'blue',
            strokeWidth: 1,
            visible
        })
        const cpC = Ellipse({
            cx: c, cy: d,
             width: 12, height: 12,
            fill: 'white',
            stroke: 'blue',
            strokeWidth: 1,
            visible
        })
        const cpD = Ellipse({
            cx: a, cy: d,
             width: 12, height: 12,
            fill: 'white',
            stroke: 'blue',
            strokeWidth: 1,
            visible
        });
        Object.assign(_parts_, {
            root,
            boundary,
            cpA,
            cpB,
            cpC,
            cpD,
        });
        root.addToStack(boundary);
        root.addToStack(cpA);
        root.addToStack(cpB);
        root.addToStack(cpC);
        root.addToStack(cpD);
        jc.stage.addToToolStack(root);

        jc.stage.addEventListener('click', e => {
            // console.log(e.detail.target);
            const shape = e.detail.target;
            if(shape === jc.stage) {
                _hide();
            } else {
                _render(shape);
            }
        });
        jc.stage.addEventListener('dragstartonstage', e => {
            if(!target.cpDragging) {
                _hide(true);
            }
        });
        jc.stage.addEventListener('dragendonstage', e => {
            const shape = target.shape;
            if(shape) {
                _render(shape);
            }
        });
        jc.stage.addEventListener('zoom', e => {
            if(target.shape) {
                const zoom = 1/e.detail.zoom;
                // console.log(zoom)
                cpA.setScale(zoom, zoom);
                cpB.setScale(zoom, zoom);
                cpC.setScale(zoom, zoom);
                cpD.setScale(zoom, zoom);
                root.updateWorldMatrix()
                root.markMaterialDrity();
            }
        })

        _cpHandler(cpA, 'lt');
        _cpHandler(cpB, 'rt');
        _cpHandler(cpC, 'rb');
        _cpHandler(cpD, 'lb');
        
    }

    return {
        name: 'SelectBox',
        setup,
    }

}

export default SelectBox;