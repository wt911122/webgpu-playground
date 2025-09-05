import JCanvas from './jcanvas';

import SDFPainter from './shape/sdf';
import GridPainter from './shape/grid';
import PolylinePainter from './shape/polyline/painter.js';

import EllipseCtor from './instance/ellipse';
import RectangleCtor from './instance/rectangle';
import PolyLineCtor from './instance/polyline';

import { vec2, mat3 } from 'gl-matrix';

(async function () {

    const jc = new JCanvas();
    jc.usePainter(GridPainter);
    
   
    jc.usePainter(SDFPainter);
    jc.usePainter(PolylinePainter);

    const Ellipse = jc.useShape(EllipseCtor);
    const Rectangle = jc.useShape(RectangleCtor);
    const PolyLine = jc.useShape(PolyLineCtor);
    


    // painter的顺序和堆叠顺序需要一致
    // const gridPainter = jc.use(GridPainter);
    // const sdfPainter = jc.use(SDFPainter);
    // const polylinePainter = jc.use(PolylinePainter);

    // const { painter } = 
    // painter.configs.push({})
    // const { Ctors } = 
    // const [ Ellipse, Rectangle ] = Ctors;
    // const { Ctors: Ctors2 } = jc.use(PolylinePainter);
    // const [ PolyLine ] = Ctors2;

    const stage = jc.stage;
    //  const circle = Ellipse({
    //     cx: 100,
    //     cy: 400,
    //     width: 100,
    //     height: 100,
    //     fill: 'rgb(255, 0, 255)',
    //     stroke: 'black',
    //     storkeWidth: 2,
    // });
    // stage.addToStack(circle);
    // circle.addEventListener('mouseenter', onMouseEnter)
    // circle.addEventListener('mouseleave', onMouseLeave)

    // const ellipse = Ellipse({
    //     cx: 100,
    //     cy: 70,
    //     width: 180,
    //     height: 100,
    //     fill: 'rgb(255, 255, 0)',
    //     stroke: 'black',
    //     storkeWidth: 2,
    // });
    // stage.addToStack(ellipse);
    // ellipse.addEventListener('mouseenter', onMouseEnter)
    // ellipse.addEventListener('mouseleave', onMouseLeave)

    const rect = Rectangle({
        cx: 220,
        cy: 300,
        width: 180,
        height: 100,
        fill: 'rgb(0, 255, 255)',
        stroke: 'black',
        storkeWidth: 2,
        strokeLineDash: [1, 10]
    });
    stage.addToStack(rect);
    rect.addEventListener('mouseenter', onMouseEnter)
    rect.addEventListener('mouseleave', onMouseLeave)


    const rect2 = Rectangle({
        cx: 420,
        cy: 300,
        width: 180,
        height: 100,
        fill: `rgb(${Math.floor(Math.random()*255)}, ${Math.floor(Math.random()*255)}, ${Math.floor(Math.random()*255)})`,
        stroke: 'black',
        storkeWidth: 2,
    });
    stage.addToStack(rect2);
    // rect.addEventListener('mouseenter', onMouseEnter)
    // rect.addEventListener('mouseleave', onMouseLeave)
    // const rect2 = Rectangle({
    //     cx: 200,
    //     cy: 200,
    //     width: 20,
    //     height: 20,
    //     fill: 'white',
    //     stroke: 'red',
    //     storkeWidth: 1,
    //     borderRadius: 10,
    // });
    // stage.addToStack(rect2);
    // rect2.addEventListener('mouseenter', onMouseEnter)
    // rect2.addEventListener('mouseleave', onMouseLeave)


    // const rect3 = Rectangle({
    //     cx: 200,
    //     cy: 300,
    //     width: 20,
    //     height: 20,
    //     fill: 'white',
    //     stroke: 'red',
    //     storkeWidth: 1,
    //     borderRadius: 10,
    // });
    // stage.addToStack(rect3);

    // const rect4 = Rectangle({
    //     cx: 400,
    //     cy: 500,
    //     width: 20,
    //     height: 20,
    //     fill: 'white',
    //     stroke: 'red',
    //     storkeWidth: 1,
    //     borderRadius: 10,
    // });
    // stage.addToStack(rect4);
    // rect2.addEventListener('mouseenter', onMouseEnter)
    // rect2.addEventListener('mouseleave', onMouseLeave)


    // const line = PolyLine({
    //     path: [
    //         200, 200, 
    //         200, 300, 
    //         400, 500, 
    //         400, 600, 
    //         600, 700,
    //         800, 700
    //     ],
    //     storkeWidth: 4,
    //     stroke: 'black',
    // })
    // stage.addToStack(line);
    // const line2 = PolyLine({
    //     path: [
    //         600, 200, 
    //         700, 300, 
    //         800, 500, 
    //         700, 600, 
    //     ],
    //     storkeWidth: 2,
    //     stroke: 'blue',
    //     lineDash: [2, 10]
    // })
    // stage.addToStack(line2);

    // const line3 = PolyLine({
    //     path: new Array(50000).fill(0).map((i, idx) => {
    //         return idx%2 === 1 ? Math.floor(Math.random() * 400 + 200) : idx*1;
    //     }),
    //     storkeWidth: 2,
    //     stroke: 'red',
    // })
    // stage.addToStack(line3);

    // const circle2 = Circle({
    //     cx: 250,
    //     cy: 200,
    //     r: 100,
    //     fill: 'rgb(0, 125, 255)',
    //     stroke: 'black',
    //     storkeWidth: 3,
    // });
    // stage.addToStack(circle2);
    function onMouseEnter(event) {
        const t = event.detail.target;
        t._fillLast = t.fill;
        t.fill = `rgb(255,0,0)`;
        t.shadowColor = 'rgba(0,0,0,0.3)';
        t.shadowBlur = 10;
        t.shadowOffsetX = 10;
        t.shadowOffsetY = 0;
    }
    function onMouseLeave(event) {
        const t = event.detail.target;
        t.fill = t._fillLast;
        t.shadowBlur = 0
    }
    // let i=0;
    // while(i<3000) {
    //     const circle = Rectangle({
    //         cx: Math.random()*800,
    //         cy: Math.random()*600,
    //         width: Math.random()*20 + 5,
    //         height: Math.random()*20 + 5,
    //         fill: `rgb(${Math.floor(Math.random()*255)}, ${Math.floor(Math.random()*255)}, ${Math.floor(Math.random()*255)})`,
    //         stroke: 'black',
    //         storkeWidth: 1,
    //         borderRadius: 2,
    //         strokeLineDash: [1, 10]
            
    //     });
    //     console.log(circle.fill)
    //     stage.addToStack(circle);
    //     circle.addEventListener('mouseenter', onMouseEnter)
    //     circle.addEventListener('mouseleave', onMouseLeave)
    //     i++;
    // } 
    stage.updateWorldMatrix();
    
    const wrapper = document.getElementById('app');
    await jc.$mount(wrapper);
    jc.mesh();
    const canvas = jc.canvas;
    canvas.addEventListener('wheel', (event) => {
        event.preventDefault();
        let { offsetX, offsetY, deltaX, deltaY } = event
        if(event.ctrlKey) { 
            // deltaY = -deltaY;
            
            jc.zoom(offsetX, offsetY, deltaX, deltaY);
        } else {
            jc.pan(deltaX, deltaY);
        }
    });
    
    let currentTarget = null;
    canvas.addEventListener('pointermove', (event) => {
        event.preventDefault();
        const { offsetX, offsetY } = event;
        const target = jc.lockTarget(offsetX, offsetY);
        if(currentTarget !== target) {
            currentTarget && currentTarget.dispatchEvent(new CustomEvent('mouseleave', { detail: { target: currentTarget } })) ;
            currentTarget = target;
            target && target.dispatchEvent(new CustomEvent('mouseenter', { detail: { target: currentTarget } })) 
        } 
    })

    function _dragdrop() {
        const context = {
            target: null,
            targetLocalMtx: null,
            targetWorldMtxInv: mat3.create(),
            pos: null,
            vec: vec2.create(),
        };
        dragdropBehavior({
            dragStart(x, y) {
                const target = jc.lockTarget(x, y);
                if(target) {
                    context.target = target;
                    context.targetLocalMtx = mat3.clone(target._localTransform)
                    mat3.invert(context.targetWorldMtxInv, target._worldTransform)
                    context.pos = vec2.clone(jc._mousevec)
                    return true;
                }
            },
            dragMove(x, y) {
                const { target, vec, pos, targetLocalMtx, targetWorldMtxInv } = context;
                const locationMtx = target._localTransform;
                jc.viewport2Canvas(x, y, vec);
                vec2.subtract(vec, vec, pos);
                vec2.transformMat3(vec, vec, targetWorldMtxInv);
                mat3.translate(locationMtx, targetLocalMtx, vec);
                target.updateBoundingBox();
                target.markDirty();
                // console.log(locationMtx[6], locationMtx[7]);
            },
            dragEnd() {
                Object.assign(context, {
                    target: null,
                    targetLocalMtx: null,
                    targetWorldMtxInv: mat3.create(),
                    pos: null,
                    vec: vec2.create(),
                })
            }
        })
    }

    _dragdrop();

    
    jc.render();   
    
    
    function dragdropBehavior({
        dragStart,
        dragMove,
        dragEnd
    }) {
        canvas.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            const { offsetX, offsetY } = event;
            let processing = false;
            let dragging = false;
            const f = (e) => {
                if(processing) {
                    return;
                }
                processing = true;
                if(dragging) {
                    dragMove(e.offsetX, e.offsetY);
                    processing = false;
                    return;
                }

                const { offsetX: currX, offsetY: currY } = e;
                if(Math.hypot(currX - offsetX, currY - offsetY) > 2) {
                    dragging = dragStart(currX, currY)
                }
                processing = false;
            }

            const u = (event) => {
                document.removeEventListener('pointermove', f);
                dragEnd(event.offsetX, event.offsetY);
                processing = false;
                dragging = false;
            }
            document.addEventListener('pointermove', f)  
            document.addEventListener('pointerup', u, {
                once: true,
                capture: true,
            });
        
        })
    }
   
})()
