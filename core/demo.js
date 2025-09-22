import JCanvas from './jcanvas';

// import SDFPainter from './shape/sdf';
// import GridPainter from './shape/grid';
// import PolylinePainter from './shape/polyline/painter-new.js';
// import MeshPainter from './shape/mesh';

// import GroupCtor from './layer/group';
// import EllipseCtor from './instance/ellipse';
// import RectangleCtor from './instance/rectangle';
// import PolyLineCtor from './instance/polyline';
// import PathCtor from './instance/path';
// import TextCtor from './instance/Text';

import { vec2, mat3 } from 'gl-matrix';
import opentype from 'opentype.js';


(async function () {

    const jc = new JCanvas();
    // jc.usePainter(GridPainter);
    
    // jc.usePainter(SDFPainter);
    // jc.usePainter(MeshPainter);
    // jc.usePainter(PolylinePainter);

    // const Group = jc.useShape(GroupCtor);
    // const Ellipse = jc.useShape(EllipseCtor);
    // const Rectangle = jc.useShape(RectangleCtor);
    // const Path = jc.useShape(PathCtor);
    // const PolyLine = jc.useShape(PolyLineCtor);
    // const Text = jc.useShape(TextCtor);


    const Group = jc.getShapeCtor('Group');
    const Ellipse = jc.getShapeCtor('Ellipse');
    const Rectangle = jc.getShapeCtor('Rectangle');
    const Path = jc.getShapeCtor('Path');
    const PolyLine = jc.getShapeCtor('PolyLine');
    const Text = jc.getShapeCtor('Text');

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
    //     strokeWidth: 2,
    // });
    // stage.addToStack(circle);
    // circle.addEventListener('mouseenter', onMouseEnter)
    // circle.addEventListener('mouseleave', onMouseLeave)

    const ellipse = Ellipse({
        cx: 100,
        cy: 70,
        width: 180,
        height: 100,
        fill: 'rgb(255, 255, 0)',
        stroke: 'black',
        strokeWidth: 1,
    });
    stage.addToStack(ellipse);
    const ellipse2 = Ellipse({
        cx: 140,
        cy: 90,
        width: 180,
        height: 100,
        fill: 'rgb(255, 255, 0)',
        stroke: 'black',
        strokeWidth: 1,
    });
    stage.addToStack(ellipse2);
    // ellipse.addEventListener('mouseenter', onMouseEnter)
    // ellipse.addEventListener('mouseleave', onMouseLeave)

    // const path = Path({
    //     path: "M58.285 140.368l-2.197.784c-.785 0-5.18 1.413-7.377 5.337 0 0 4.866-3.767 9.574-6.121zm34.417 36.352c.055.099.077.263.191.271.259.016.742.134.693-.114-.332-1.69-.675-3.629-2.297-4.335-.25-.11-.816.05-.845.4-.05.596-.096 1.126.025 1.699.118.561.964.561 1.324.02.368.655.537 1.38.909 2.06zm-4.347 1.856c.294.554.244 1.283.8 1.507.29.114 1.015-.267.851-.69-.314-.809-.466-1.688-1.011-2.398-.079-.102.015-.31-.048-.44-.233-.478-.682-.768-1.234-.639-.438.863.013 1.699.61 2.37.053.059-.012.208.032.29zm-15.538-2.036c-.042-.15-.057-.33.007-.455.209-.404.52-.844.388-1.248-.137-.412-.575-.341-.83-.118-.445.389-.464 1.107-.736 1.64-.076.15-.056.377-.23.53-.185.165-.358.761-.32.985.02.126-.051 4.01.036 3.908.243-.286 1.44-4.108 1.466-4.457.023-.287.31-.467.219-.785zm-10.06-2.664c1.034-.981 2.129-2.143 1.955-3.598-.045-.385-.742-.177-.815.153-.315 1.424-1.115 2.468-2.122 3.406-.862.804-1.593 3.291-1.685 3.492 1.45-2.064 2.336-3.14 2.667-3.453zm-5.326-2.339c.206-.149.087-.341.172-.47.374-.573.885-1.06.892-1.743 0-.11-.147-.231-.279-.14-.109.07-.243.12-.285.172-.797.961-1.346 2.009-1.912 3.111-.072.141-.52 1.903-.398 1.946.094.036.769-1.604.851-1.652.496-.266.5-.902.96-1.224zm6.566 7.667c.174-.341.792-.812.748-1.161-.046-.365.137-.93-.22-.66-.494.37-1.847.899-1.953 3.179-.01.223 1.157-.832 1.425-1.358zm5.667-6.741c.157-.263.435-.074.615-.18.254-.145.494-.365.608-.62.38-.84 1.075-1.554 1.131-2.496-.585-.549-.851.251-1.099.628-.519-.647-.91.09-1.42.294-.028.012-.112-.125-.141-.113-.462.172-.729.596-1.12.902-.068.051-.226-.02-.284.035-.256.236-.638.365-.748.632-.435 1.06-1.667 1.883-2.408 4.842.15.357 1.77-2.605 1.962-2.88.328-.47.374.651.875.392.02-.011.093.083.145.134.077-.11.162-.2.314-.157 0-.157-.052-.377.027-.436.485-.384.452-.804.758-1.29.18.31.596.027.785.313zm23.463 21.345s2.904-8.004 1.177-12.399c0 0 4.473 8.475 2.668 12.87 0 0-.156-4.08-1.726-6.043 0 0-1.57 5.023-2.119 5.572zm-5.807-1.02s2.12-3.453-1.02-10.673c0 0-.314 8.005-2.982 12.32 0 0 5.572-7.925 4.002-1.647zm-3.923-.785s-.079-7.847.078-9.024c0 0-1.49 6.513-5.493 10.28 0 0 5.65-4.709 5.415-1.256zm-3.767-12.556s2.354 5.337-1.57 12.556c0 0 2.512-4.787.628-7.533 0 0 1.02-1.334.942-5.023zm-7.534 12.399s-.392-6.12.314-6.984c0 0 .079-2.511-.078-2.904 0 0 1.57-2.432 1.648.471 0 0 .55 3.06 1.648 4.866 0 0 1.412 2.118 1.334 4.63 0 0-3.924-11.85-4.866-.079zm-1.412-10.829s-2.59 4.237-3.296 11.692c0 0-.55-2.432.942-8.082 0 0 1.648-6.043 2.354-3.61zm-8.554 7.769s1.962-2.12 2.512-4.08c0 0 1.412-6.2-1.1-2.826 0 0 .08 3.139-3.138 6.042 0 0 1.883-.941 1.726.864zm-2.275-1.962s1.334-6.827 1.648-7.141c0 0 .706-1.334-.393-.079 0 0-3.453 7.534-5.022 10.123 0 0 3.139-3.61 3.767-2.903zm-2.276-6.514s4.551-8.788-4.002 1.335c0 0 4.316-3.846 4.002-1.334zm-6.042-5.728s1.883-7.376 2.903-7.298l.628.628s-2.354 3.767-2.119 7.612c0 0-.235-3.767-1.412-.942zm129.598-4.473s-4.708-3.924-5.69-5.297c0 0 5.298 7.259 5.298 10.005 0 0 .98-2.942.392-4.708zm2.158-8.632s-8.24-5.886-9.613-8.828c0 0 10.398 11.575 10.398 13.34 0 0 .196-3.531-.785-4.512zm6.67-60.424s-4.708-3.14-5.297-2.355c0 0 4.12 2.55 5.101 5.886 0 0-.588-3.531.196-3.531zm3.335 31.585l-6.866-4.708s7.455 6.67 7.651 8.24l-.785-3.532z",
    //     fill: 'rgb(0, 255, 255)',
    //     stroke: 'black',
    //     strokeWidth: 2,
    // })
    // stage.addToStack(path);
    // const ellipse = Ellipse({
    //     cx: 95,
    //     cy: 80,
    //     width: 4,
    //     height: 4,
    //     fill: 'rgb(255, 255, 0)',
    //     stroke: 'black',
    //     strokeWidth: 1,
    // });
    // stage.addToStack(ellipse);


    // const path2 = Path({
    //     path: `M 10,30
    //        A 20,20 0,0,1 50,30
    //        A 20,20 0,0,1 90,30
    //        Q 90,60 50,90
    //        Q 10,60 10,30 
    //        M 10 80 
    //        C 40 10, 65 10, 95 80 
    //        S 150 150, 180 80`,
    //     fill: 'rgb(0, 255, 255)',
    //     stroke: 'black',
    //     strokeWidth: 2,
    // })
    // stage.addToStack(path2);

    
    // const rect = Rectangle({
    //     cx: 220,
    //     cy: 300,
    //     width: 180,
    //     height: 100,
    //     fill: 'rgb(0, 255, 255)',
    //     stroke: 'black',
    //     strokeWidth: 2,
    //     borderRadius: 12,
    //     strokeLineDash: [1, 10]
    // });
    // stage.addToStack(rect);
    // rect.addEventListener('mouseenter', onMouseEnter)
    // rect.addEventListener('mouseleave', onMouseLeave)


    // const rect2 = Rectangle({
    //     cx: 420,
    //     cy: 300,
    //     width: 180,
    //     height: 100,
    //     fill: `rgb(${Math.floor(Math.random()*255)}, ${Math.floor(Math.random()*255)}, ${Math.floor(Math.random()*255)})`,
    //     stroke: 'black',
    //     strokeWidth: 2,
    // });
    // stage.addToStack(rect2);
    // rect.addEventListener('mouseenter', onMouseEnter)
    // rect.addEventListener('mouseleave', onMouseLeave)
    // const rect2 = Rectangle({
    //     cx: 200,
    //     cy: 200,
    //     width: 20,
    //     height: 20,
    //     fill: 'white',
    //     stroke: 'red',
    //     strokeWidth: 1,
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
    //     strokeWidth: 1,
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
    //     strokeWidth: 1,
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
    //     strokeWidth: 4,
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
    //     strokeWidth: 2,
    //     stroke: 'blue',
    //     lineDash: [2, 10]
    // })
    // stage.addToStack(line2);

    // const line3 = PolyLine({
    //     path: new Array(50000).fill(0).map((i, idx) => {
    //         return idx%2 === 1 ? Math.floor(Math.random() * 400 + 200) : idx*1;
    //     }),
    //     strokeWidth: 2,
    //     stroke: 'red',
    // })
    // stage.addToStack(line3);

    // const circle2 = Circle({
    //     cx: 250,
    //     cy: 200,
    //     r: 100,
    //     fill: 'rgb(0, 125, 255)',
    //     stroke: 'black',
    //     strokeWidth: 3,
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
    // while(i<1000) {
    //     const circle = Rectangle({
    //         cx: Math.random()*800,
    //         cy: Math.random()*600,
    //         width: Math.random()*20 + 5,
    //         height: Math.random()*20 + 5,
    //         fill: `rgb(${Math.floor(Math.random()*255)}, ${Math.floor(Math.random()*255)}, ${Math.floor(Math.random()*255)})`,
    //         stroke: 'black',
    //         strokeWidth: 1,
    //         // borderRadius: 10,
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
    /*canvas.addEventListener('wheel', (event) => {
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

    function checkTarget(target) {
        let t = target;
        while(t.parent) {
            if(t.parent.lock) {
                return t.parent;
            }
            t = t.parent;
        }
        return target;
    }
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
                const lockedTarget = jc.lockTarget(x, y);
                if(lockedTarget) {
                    const target = checkTarget(lockedTarget);
                    context.target = target;
                    context.targetLocalMtx = mat3.clone(target._localTransform)
                    mat3.invert(context.targetWorldMtxInv, target.parent.matrix)
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
                target.updateWorldMatrix(target.parent.matrix);
                target.markMaterialDrity();
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
    */ 
    
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
   
    // fetch(
    //   '/assets/Ghostscript_Tiger.svg',
    // ).then(async (res) => {
    //     const svg = await res.text();

    //     const $container = document.createElement('div');
    //     $container.innerHTML = svg;

    //     const $svg = $container.children[0];

    //     const group = Group({
    //         x: 200,
    //         y: 0,
    //         lock: true,
    //     });
    //     for (const child of $svg.children) {
    //         const attrs = fromSVGElement(child);
    //         console.log(attrs);
    //         deserializeNode(attrs, group);
    //     }

    //     stage.addToStack(group);
    //     group.updateWorldMatrix(stage.matrix)
    // });

    function deserializeNode(data, parent) {
        const { type, attributes, children } = data;
        let shape;
        if (type === 'g') {
            shape = Group();
        } else if (type === 'circle') {
            // shape = new Circle();
        } else if (type === 'ellipse') {
            // shape = new Ellipse();
        } else if (type === 'rect') {
            // shape = new Rect();
        } else if (type === 'polyline') {
            // shape = new Polyline();
        } else if (type === 'path') {
            shape = Path({
                path: attributes.d,
                fill: attributes.fill,
                stroke: attributes.stroke,
                strokeWidth: attributes.strokeWidth,
            });
        }
        parent.addToStack(shape);
        if(children.length) {
            children.map((child) => {
                deserializeNode(child, shape);
            });
        } 
        
    }

    // fetch('/assets/PingFangSC-main/ttf/PingFangSC-Regular.ttf')
    //     .then(async res => {
    //         const buffer = await res.arrayBuffer();
    //         const font = opentype.parse(buffer);
    //         const para = Text({
    //             content: '旺旺仙贝',
    //             x: 150,
    //             y: 200,
    //             fill: 'black',
    //             fontSize: 24,
    //             font,
    //         })
    //         stage.addToStack(para)
    //         stage.updateWorldMatrix();
    //         para.addEventListener('mouseenter', onMouseEnter)
    //         para.addEventListener('mouseleave', onMouseLeave)
    //     })

    function kebabToCamelCase(str) {
        return str.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
    }
    function fromSVGElement(element, uid = 0) {
        const type = element.tagName.toLowerCase();
        const attributes = Array.from(element.attributes).reduce((prev, attr) => {
            const attributeName = kebabToCamelCase(attr.name);

            let value = attr.value;
            if (attributeName === 'transform') {
                value = parseTransform(value);
            } else if (
                attributeName === 'opacity' ||
                attributeName === 'fillOpacity' ||
                attributeName === 'strokeOpacity' ||
                attributeName === 'strokeWidth' ||
                attributeName === 'strokeMiterlimit' ||
                attributeName === 'strokeDashoffset'
            ) {
                value = Number(value);
            }

            prev[attributeName] = value;
            return prev;
        }, {});

        const children = Array.from(element.children).map((e) =>
            fromSVGElement(e, uid++),
        );

        return {
            uid,
            type,
            attributes,
            children,
        };
    }
})()
