import { mat3, vec2 } from 'gl-matrix';
import { projectVector } from '../utils/transform';

function SelectBox() {
    const _parts_ = {
        root: null,
        boundary: null,
        cpA: null,
        cpB: null,
        cpC: null,
        cpD: null,
        cpRotate: null,
    }

    const target = {
        shape: null,
        cpDragging: false,
    }


    function _render(shape) {
        target.shape = shape;
        const box = shape.getBoundingBox();
        const { LT, RB, LB, RT } = box; 
        const {
            root,
            boundary,
            cpA,
            cpB,
            cpC,
            cpD,
            cpRotate
        } = _parts_;

        // console.log(`M${LT[0]} ${LT[1]}L${RT[0]} ${RT[1]}L${RB[0]} ${RB[1]}L${LB[0]} ${LB[1]}Z`)
        boundary.path = `M${LT[0]} ${LT[1]}L${RT[0]} ${RT[1]}L${RB[0]} ${RB[1]}L${LB[0]} ${LB[1]}Z`,
        // cpA.x = LT[0]; cpA.y = LT[1];
        // cpA.flushTransform();
        // cpB.x = RT[0]; cpB.y = RT[1];
        // cpB.flushTransform();
        // cpC.x = RB[0]; cpC.y = RB[1];
        // cpC.flushTransform();
        // cpD.x = LB[0]; cpD.y = LB[1];
        // cpD.flushTransform();
        // console.log(boundary.path)
        
        // cpRotate.x = LT[0] + (RT[0] - LT[0])/2;
        // cpRotate.y = LT[1] + (RT[1] - LT[1])/2;
        // cpRotate.flushTransform();
        boundary.visible = true;
        // cpA.visible = true;
        // cpB.visible = true;
        // cpC.visible = true;
        // cpD.visible = true;
        // cpRotate.visible = true;
        root.updateWorldMatrix();
    }

    function _hide(temporary) {
        const {
            boundary,
            cpA,
            cpB,
            cpC,
            cpD,
            cpRotate,
        } = _parts_;
        boundary.visible = false;
        cpA.visible = false;
        cpB.visible = false;
        cpC.visible = false;
        cpD.visible = false;
        cpRotate.visible = false;
        if(!temporary) {
            target.shape = null;
        }   
    }

    function _cpHandler(cp, dir, cp1, cp2, cp3) {
        const tempVec = vec2.create();
        const context = {
            cp: dir,
            fx: 0,
            fy: 0,
            matInv: mat3.create(),
            vecf: vec2.create(),
            vecfP: vec2.create(),
            tx: 0,
            ty: 0,
            vect: vec2.create(),
            vectP: vec2.create(),
            vecDelta: vec2.create(),
            vecDeltaP: vec2.create(),
        }

        cp.addEventListener('mouseenter', () =>{
            cp.fill = 'blue';
        })
        cp.addEventListener('mouseleave', () =>{
            cp.fill = 'white';
        })
        cp.addEventListener('dragstart', (e) => {
            e.preventDefault();
            const shape = target.shape;
            const matrix = shape.matrixInv;
            const shapeBounding = shape._localBoundingbox;
            mat3.copy(context.matInv, matrix);
            
            // vec2.transformMat3(temp1, cp1.position, matrix);
            // vec2.transformMat3(temp2, cp2.position, matrix);
            // vec2.transformMat3(temp3, cp3.position, matrix);

            vec2.set(tempVec, e.detail.canvasX, e.detail.canvasY)
            vec2.transformMat3(context.vecf, tempVec, matrix);
            vec2.transformMat3(context.vecfP, tempVec, shape.parent.matrixInv);

            Object.assign(context, {
                fx: e.detail.canvasX,
                fy: e.detail.canvasY,
                tx: 0,
                ty: 0,
            })

            shape.editBoundaryStart(context);
            target.cpDragging = true;
        })
        const flag = (dir === 'lt' || dir === 'rb');
        cp.addEventListener('dragging', (e) => {
            context.tx = e.detail.canvasX;
            context.ty = e.detail.canvasY;
            const shape = target.shape;
            const matrix = context.matInv;

            vec2.set(tempVec, e.detail.canvasX, e.detail.canvasY);
            vec2.transformMat3(context.vect, tempVec, matrix);
            vec2.transformMat3(context.vectP, tempVec, shape.parent.matrixInv);
            vec2.subtract(context.vecDelta, context.vect, context.vecf);
            vec2.subtract(context.vecDeltaP, context.vectP, context.vecfP);

            shape.editBoundary(context);
            _render(shape)
        })
        cp.addEventListener('dragend', (e) => {
            const shape = target.shape;
            shape.editBoundaryEnd(context);
            target.cpDragging = false;
        }) 
    }

    function _cpRotateHandler(cp) {
        const tempVec = vec2.create();
        const context = {
            fx: 0,
            fy: 0,
            vecf: vec2.create(),
            tx: 0,
            ty: 0,
            vect: vec2.create(),
            matInv: mat3.create(),
        }
        cp.addEventListener('mouseenter', () =>{
            cp.fill = 'blue';
        })
        cp.addEventListener('mouseleave', () =>{
            cp.fill = 'yellow';
        })
        cp.addEventListener('dragstart', (e) => {
            e.preventDefault();
            const shape = target.shape;
            const matrix = shape.matrixInv;
            mat3.copy(context.matInv, matrix);
            vec2.set(tempVec, e.detail.canvasX, e.detail.canvasY);
            vec2.transformMat3(context.vecf, 
                tempVec,
                matrix);

            Object.assign(context, {
                fx: e.detail.canvasX,
                fy: e.detail.canvasY,
                tx: 0,
                ty: 0,
            });
            
            shape.rotateStart(context);
            target.cpDragging = true;
        })
        cp.addEventListener('dragging', (e) => {
            context.tx = e.detail.canvasX;
            context.ty = e.detail.canvasY;
            const shape = target.shape;
            const matrix = context.matInv
            vec2.set(tempVec, e.detail.canvasX, e.detail.canvasY);
            vec2.transformMat3(context.vect, 
                tempVec,
                matrix);

            shape.rotate(context);
            _render(shape)
        })
        cp.addEventListener('dragend', (e) => {
            const shape = target.shape;
            shape.rotateEnd(context);
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
            strokeWidth: 0.5,
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
        const cpRotate = Ellipse({
            cx: c + 15, cy: b,
            width: 12, height: 12,
            fill: 'yellow',
            stroke: 'blue',
            strokeWidth: 1,
            visible
        })
        Object.assign(_parts_, {
            root,
            boundary,
            cpA,
            cpB,
            cpC,
            cpD,
            cpRotate
        });
        root.addToStack(boundary);
        // root.addToStack(cpA);
        // root.addToStack(cpB);
        // root.addToStack(cpC);
        // root.addToStack(cpD);
        // root.addToStack(cpRotate);
        jc.stage.addToToolStack(root);

        jc.stage.addEventListener('click', e => {
            // console.log(e.detail.target);
            const shape = e.detail.target;
            if(shape === jc.stage) {
                _hide();
            } else {
                console.log(shape)
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
                // const t = [zoom, zoom];
                // cpA.scale = t;
                // cpA.flushTransform();
                // cpB.scale = t;
                // cpB.flushTransform();
                // cpC.scale = t;
                // cpC.flushTransform();
                // cpD.scale = t;
                // cpD.flushTransform();
                // cpRotate.scale = t;
                // cpRotate.flushTransform();
                root.updateWorldMatrix()
                root.markMaterialDrity();
            }
        })

        _cpHandler(cpA, 'lt', cpB, cpC, cpD);
        _cpHandler(cpB, 'rt', cpC, cpD, cpA);
        _cpHandler(cpC, 'rb', cpD, cpA, cpB);
        _cpHandler(cpD, 'lb', cpA, cpB, cpC);
        _cpRotateHandler(cpRotate)
    }

    return {
        name: 'SelectBox',
        setup,
    }

}

export default SelectBox;