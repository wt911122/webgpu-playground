import JCanvas, { 
    createLinearGradientTextureCanvas, 
    defaultLinearOptions,
    createRadialGradientTextureCanvas,
    defaultRadialOptions,
    createImageTexture
} from './jcanvas';
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

// import demoFigmaJson from './demo-figmajson.json';
import { iterator } from './resolve-figmajson';
import figmademojson from './figmademo.json';
// import figmademojsonBig from './demo-figmajson-big.json';
// import untitlefigmajson from './untitlefigmajson2.json';
// import arrowFigmajson from './arrow-figmajson.json';
// import untitlefigmajson from './untitlefigmajson2.json';
import figmademojsonBig2 from './demo-figmajson-big2.json';
import knowlegetitlejson from './demo-figmajson-knowlegetitle.json'
import touxiangjson from './figma-touxiang-json.json';
import figmatoken from './figmatoken.env?raw';

(async function () {
    // const yaheifontRes = await fetch('/assets/font/ya-hei-ascii-msdf.json');
    // const yaheifontjson = await yaheifontRes.json();
    // const texture = await fetch('/assets/font/ya-hei-ascii.png');
    // const yaheifontBitmap = await createImageBitmap(texture);

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

    await jc.registMSDFont('ya-hei-ascii', '/assets/font/');
    await jc.registMSDFont('PingFangSC-Regular', '/assets/PingFangSC-msdf/');

    const Group = jc.getShapeCtor('Group');
    const Ellipse = jc.getShapeCtor('Ellipse');
    const Rectangle = jc.getShapeCtor('Rectangle');
    const Path = jc.getShapeCtor('Path');
    // const PolyLine = jc.getShapeCtor('PolyLine');
    const Text = jc.getShapeCtor('Text');
    const MSDFText = jc.getShapeCtor('MSDFText');

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
    const t = {};
    //  iterator(demoFigmaJson, t);
    // console.log(demoFigmaJson, t)
    // const json = figmademojson.nodes["10992:224682"].document;
    // const json = figmademojsonBig.nodes["10992:224704"].document;
    // const json = untitlefigmajson.nodes["179:1048"].document;
    // const json = arrowFigmajson.nodes["181:1108"].document;
    // const json = arrowFigmajson.nodes["181:1108"].document;
    // iterator(json, t)
    // console.log(json, t)

    function resolveFillColor(data) {
        const type = data.type;
        if(type === 'SOLID') {
            return {
                fill: data.color
            }
        }
        if(type === 'GRADIENT_LINEAR') {
            return {
                texture: createLinearGradientTextureCanvas({
                    ...defaultLinearOptions,
                    colorStops: data.colorstops
                })
            }
        }
        return {
            fill: '',
        };
    }
    function resolveStrokeColor(data) {
        const type = data.type;
        if(type === 'SOLID') {
            return {
                stroke: data.color
            };
        }
        // if(type === 'GRADIENT_LINEAR') {
        //     return createLinearGradientTextureCanvas({
        //         ...defaultLinearOptions,
        //         colorStops: data.colorstops
        //     })
        // }
        return {
            stroke: '',
        };
    }
    function iteratorCreate(data, group, firstLayer, initx, inity) {
        let shape;
        const type = data.type;
        if(type === 'Group') {
            shape = Group();
            group.addToStack(shape);
            shape.rotation = data.rotation;  
            shape.hasMask = data.clipsContent;
            // console.log(data.clipsContent)
        } else if (type === 'Rectangle' || type === 'GroupRectangle' || type === 'FrameRectangle') {
            shape = Rectangle({ 
                x: data.x,
                y: data.y,
                width: data.width,
                height: data.height,
                opacity: data.opacity,
                ...resolveFillColor(data.fill),
                ...resolveStrokeColor(data.stroke),
                rotation: data.rotation,
                strokeWidth: {
                    left: data.strokeWidth[0],
                    top: data.strokeWidth[1],
                    right: data.strokeWidth[2],
                    bottom: data.strokeWidth[3],
                },
                borderRadius: {
                    topLeft: data.borderRadius[0],
                    topRight: data.borderRadius[1],
                    bottomLeft: data.borderRadius[2],
                    bottomRight: data.borderRadius[3],
                }
            });
            if(type === 'Rectangle') {

                // shape.origin = [0, data.height/2]
                // shape.flushTransform();
                // if(data.constraints.horizontal === 'LEFT_RIGHT') {
                //     shape.x += group.width/2;
                // }
                // if(data.constraints.vertical === 'TOP') {
                //     shape.y += group.width/2;
                // }
            }
            if(type === 'FrameRectangle' || type === 'GroupRectangle') {
                shape.represent = group;
            }

            if(type !== 'Rectangle' && group.hasMask) {
                // console.log('setmask')
                group.setMask(shape);
            }
            
            group.addToStack(shape);
        } else if (type === 'Path' || type === 'GroupPath') {
            const pathData = data;
            const rt = data.relativeTransform;
            const fill = resolveFillColor(data.fill);
            const stroke = resolveStrokeColor(data.stroke);
            const effects = data.effects;
            data.paths.forEach(p => {
                const data = {
                    fill: '',
                    stroke: '',
                    texture: undefined,
                }
                if(p.type === 'fill') {
                    Object.assign(data, fill)
                }
                if(p.type === 'stroke') {
                    Object.assign(data, stroke)
                }
                shape = Path({
                    // x: pathData.x,
                    // y: pathData.y,
                    // rotation: pathData.rotation,
                    opacity: pathData.opacity,
                    path: p.data,
                    ...data,
                    strokeWidth: pathData.strokeWidth,
                });
                shape.applyLocalTransform(
                    rt[0][0],rt[1][0],
                    rt[0][1],rt[1][1],
                    rt[0][2],rt[1][2]);
                shape.decomposeLocalTransform();
                if(effects.length > 0) {
                    effects.forEach(effect => {
                        if(effect.type === 'LAYER_BLUR') {
                            shape.applyFilter('BlurFilter', {
                                blur: effect.radius
                            })
                        }
                    });
                }
                if(type === 'GroupPath' && group.hasMask) {
                    // console.log('setmask')
                    group.setMask(shape);
                }
                // shape.origin = [pathData.width/2,pathData.height/2]
                // shape.flushTransform(true);
                group.addToStack(shape);
            });
        } else if (type === 'Text') {
            shape = MSDFText({
                content: data.content,
                x: data.x,
                y: data.y,
                width: data.width,
                height: data.height,
                textAlignHorizontal: data.textAlignHorizontal,
                textAlignVertical: data.textAlignVertical,
                lineHeight: data.lineHeight,
                ...resolveFillColor(data.color),
                fontFamily: 'PingFangSC-Regular',
                fontSize: data.fontSize,
                autoWrap: data.autoWrap,
                ellipseEnd: data.ellipseEnd,
            })
            group.addToStack(shape);
        } else if(type === 'ELLIPSE') {
            shape = Ellipse({ 
                cx: data.x,
                cy: data.y,
                width: data.width,
                height: data.height,
                opacity: data.opacity,
                ...resolveFillColor(data.fill),
                ...resolveStrokeColor(data.stroke),
                // rotation: data.rotation,
                strokeWidth: data.strokeWidth,
            });
            group.addToStack(shape);
        }
        if(shape) {
             shape.id = data.id;
        }
       
        
        if(data.children) {
            data.children.map((child) => {
                iteratorCreate(child, shape);
            });
            shape.updateWorldMatrix();
            shape.origin = vec2.fromValues(shape.width/2, shape.height/2);
            shape.x = firstLayer ? initx: data.x;
            shape.y = firstLayer ? inity: data.y;
            shape.flushTransform();
        } 
    }

    // iteratorCreate(t, stage, true, 10, 10);
    // iteratorCreate(t, stage, true, 1000, 10);
    // iteratorCreate(t, stage, true, 10, 800);

    // function generateByFigmaFile(filejson) {
    //     for(let key in filejson) {
    //         const docjson = filejson[key].document;
    //         generateByFigmaDocument(docjson);
    //     }
    // }
    function generateByFigmaDocument(docjson) {
        const t = {};
        iterator(docjson, t);
        iteratorCreate(t, stage);
    }

    function generateByFigmaCanvas(canvasjson) {
       
        for(let docjson of canvasjson.children) {
            generateByFigmaDocument(docjson)
        }
    }

    function generateByFigma(json) {
        for(let key in json.nodes) {
            const node = json.nodes[key];
            if(node.type === '')
            generateByFigmaCanvas(node.document)
        }
    }

    function loadFromFigma(json) {
        if(json.type === "FRAME") {
            generateByFigmaDocument(json);
        }
        for(let key in json.nodes) {
            const node = json.nodes[key];
            if(node.document.type === 'CANVAS') {
                generateByFigmaCanvas(node.document);
            }
            if(node.document.type ===  "FRAME" || node.document.type ===  "INSTANCE") {
                generateByFigmaDocument(node.document);
            }
        }
    }
    // generateByFigma(figmademojsonBig);

    const showFigmaButton = document.getElementById('showFigma');
    // const filekeyinput = document.getElementById('filekey');
    const figmaURL = document.getElementById('figmaURL');
    const FIGMA_TOKENinput = document.getElementById('FIGMA_TOKEN');
    FIGMA_TOKENinput.value = figmatoken;
    showFigmaButton.addEventListener('click', () => {
        const url = new URL(figmaURL.value);
        const res = /\/design\/(.+)\//.exec(url.pathname);
        const filekey = res[1];
        const nodeid = url.searchParams.get('node-id');
        fetch(`https://api.figma.com/v1/files/${filekey}/nodes?ids=${nodeid}&geometry=paths`, {
            headers: {
                'X-Figma-Token': FIGMA_TOKENinput.value
            }
            })
            .then(response => response.json())
            .then(data => {
                stage.clear();
                loadFromFigma(data);
                // console.log(JSON.stringify(data, null, 2));
            });
    })
    loadFromFigma(figmademojsonBig2)

    // console.log(stage); 
    /* 8const response = await fetch('../assets/Di-3d.png');
    const imageBitmap = await createImageBitmap(await response.blob());
    const imageTexture = createImageTexture(imageBitmap);
    const imageTextureorigin = createImageTexture(imageBitmap);

    const linearGradientTexture = createLinearGradientTextureCanvas({
        ...defaultLinearOptions,
        colorStops: [
            {
                "offset": 0,
                "color": "rgba(161, 133, 255, 1)"
            },
            {
                "offset": 1,
                "color": "rgba(150, 192, 255, 1)"
            }
        ]
    });
    const linearGradientTextureorigin = createLinearGradientTextureCanvas({
        ...defaultLinearOptions,
        colorStops: [
            {
                "offset": 0,
                "color": "rgba(161, 133, 255, 1)"
            },
            {
                "offset": 1,
                "color": "rgba(150, 192, 255, 1)"
            }
        ]
    });
    const radialGradientTexture = createRadialGradientTextureCanvas({
        ...defaultRadialOptions,
        colorStops: [
            {
                offset: 0,
                color: 'rgba(161, 133, 255, 1)'
            },
            {
                offset: 1,
                color: 'rgba(255, 255, 255, 1)'
            }
        ]
    })

    const path2 = Path({
        path: "M0,0L200,0L200,200L0,200Z",
        opacity: 1,
        texture: linearGradientTexture,
        // strokeWidth: 2,
        stroke: 'black',
    })
    path2.applyFilter('BlurFilter', {
        filterSize: 80,
        iterations: 6,
        blur: 160
    });
    stage.addToStack(path2);

    const path3 = Path({
        x: 400,
        path: "M0,0L200,0L200,200L0,200Z",
        opacity: 1,
        texture: linearGradientTextureorigin,
        strokeWidth: 2,
        blurFilter: true,
        stroke: 'black',
    });
    stage.addToStack(path3);

     const path4 = Path({
        y: 320,
        path: "M0,0L200,0L200,200L0,200Z",
        opacity: 1,
        texture: imageTexture,
        // strokeWidth: 2,
        stroke: 'black',
    })
    
    path4.applyFilter('BlurFilter', {
        blur: 160
    });
    stage.addToStack(path4);

    const path5 = Path({
        x: 400,
        y: 320,
        path: "M0,0L200,0L200,200L0,200Z",
        opacity: 1,
        texture: imageTextureorigin,
        strokeWidth: 2,
        blurFilter: true,
        stroke: 'black',
    });
    stage.addToStack(path5);*/

    //  const circle = Ellipse({
    //     cx: 300,
    //     cy: 300,
    //     width: 200,
    //     height: 140,
    //     // fill: 'rgb(255, 255, 0)',
    //     texture: radialGradientTexture,
    //     stroke: 'black',
    //     strokeWidth: 1,
    // });
    // stage.addToStack(circle);

    //   const rect2 = Rectangle({
    //     x: 300,
    //     y: 500,
    //     width: 200,
    //     height: 140,
    //     // fill: 'rgb(255, 255, 0)',
    //     texture: radialGradientTexture,
    //     stroke: 'black',
    //     strokeWidth: 1,
    // });
    // stage.addToStack(rect2);


    // circle.addEventListener('mouseenter', onMouseEnter)
    // circle.addEventListener('mouseleave', onMouseLeave)

    /* const q = `
WebGPU exposes an API for performing operations, such as rendering
and computation, on a Graphics Processing Unit.

Graphics Processing Units, or GPUs for short, have been essential
in enabling rich rendering and computational applications in personal
computing. WebGPU is an API that exposes the capabilities of GPU
hardware for the Web. The API is designed from the ground up to
efficiently map to (post-2014) native GPU APIs. WebGPU is not related
to WebGL and does not explicitly target OpenGL ES.

WebGPU sees physical GPU hardware as GPUAdapters. It provides a
connection to an adapter via GPUDevice, which manages resources, and
the device’s GPUQueues, which execute commands. GPUDevice may have
its own memory with high-speed access to the processing units.
GPUBuffer and GPUTexture are the physical resources backed by GPU
memory. GPUCommandBuffer and GPURenderBundle are containers for
user-recorded commands. GPUShaderModule contains shader code. The
other resources, such as GPUSampler or GPUBindGroup, configure the
way physical resources are used by the GPU.

GPUs execute commands encoded in GPUCommandBuffers by feeding data
through a pipeline, which is a mix of fixed-function and programmable
stages. Programmable stages execute shaders, which are special
programs designed to run on GPU hardware. Most of the state of a
pipeline is defined by a GPURenderPipeline or a GPUComputePipeline
object. The state not included in these pipeline objects is set
during encoding with commands, such as beginRenderPass() or
setBlendConstant().
`
    let i=0;
    while(i<10000) {
        const msdftext = MSDFText({
            x: Math.random()*80000,
            y: Math.random()*60000,
            fontFamily: 'ya-hei-ascii',
            fontSize: 1/3,
            fill: `black`,
            content: q.substring(Math.random()*400)
            
        });
        // console.log(circle.fill)
        stage.addToStack(msdftext);
        i++;
    } */

//     const msdftext = MSDFText({
//         x: 200, y: 50,
//         fontFamily: 'PingFangSC-Regular',
//         fontSize: 1/3,
//         fill: 'black',
//         content: `11 月 11 日消息，多个活动组织联合宣布，将于 11 月 15 日发起一场名为「特斯拉狙击」
// （Tesla Takedown）的全球协调行动日，呼吁世界各地参与者共同抗议特斯拉首席执行官埃隆・马斯克（Elon Musk）新近获批的 2025 年绩效奖励计划。
// 今年早些时候，部分反特斯拉人士曾对多家特斯拉门店实施涂鸦、燃烧弹袭击甚至枪击，以表达对马斯克的不满。
// 此次抗议行动的直接导火索，是特斯拉股东近期批准的马斯克 2025 年绩效奖励计划——这一里程碑式的薪酬方案若全部兑现，
// 将使马斯克成为全球首位资产达万亿美元（$1 trillion）的个人。
// 组织方表示，此次运动是一场非暴力抗议，旨在反对他们所认为的「过度集中于个人手中的企业权力与巨额财富」。
// 据「特斯拉狙击」组织者介绍，11 月 15 日的抗议行动恰逢其首次大规模周末行动的九个月纪念日。
// 在一份公开声明中，该团体号召支持者以「拒绝万亿富豪」
// （#NoTrillionaires）为口号，「在你所在的社区发起或加入一场抗议行动」，并将此次活动定位为对亿万富翁深度介入政治与科技领域的明确抵制。（来源：新浪财经）`
//     })

//     stage.addToStack(msdftext);

    // const ellipse2 = Ellipse({
    //     cx: 500,
    //     cy: 50,
    //     width: 200,
    //     height: 100,
    //     fill: 'rgb(255, 255, 0)',
    //     stroke: 'black',
    //     strokeWidth: 1,
    //     // rotation: Math.PI/6
    // });
    // stage.addToStack(ellipse2);

    // const group3 = Group({ lock: true });
    // stage.addToStack(group3);

    // const group2 = Group({ lock: true });
    // group3.addToStack(group2);
    // stage.addToStack(group2);

    /* const rect5 = Rectangle({
        x: 0,
        y: 0,
        width: 200,
        height: 140,
        fill: 'rgb(255, 255, 0)',
        stroke: 'black',
        strokeWidth: 1,
    });
    const rect6 = Rectangle({
        x: 100,
        y: 50,
        width: 180,
        height: 100,
        fill: 'rgb(0, 255, 0)',
        stroke: 'black',
        strokeWidth: 1,
    });

    group2.addToStack(rect5);
    group2.addToStack(rect6);
    group2.updateWorldMatrix();
    group2.position = vec2.fromValues(200, 200);
    group2.origin = vec2.fromValues(group2.width/2, group2.height/2);
    group2.flushTransform(true);

    const rect7 = Rectangle({
        x: 0,
        y: 0,
        width: 200,
        height: 140,
        fill: 'rgba(0, 162, 255, 1)',
        stroke: 'black',
        strokeWidth: 1,
    });


    const path22 = Path({
        path: `M 10,30
           A 20,20 0,0,1 50,30
           A 20,20 0,0,1 90,30
           Q 90,60 50,90
           Q 10,60 10,30 
           M 10 80 
           C 40 10, 65 10, 95 80 
           S 150 150, 180 80`,
        fill: 'rgb(0, 255, 255)',
        stroke: 'black',
        strokeWidth: 2,
    })

    group3.addToStack(rect7);
    group3.addToStack(path22);
    group3.updateWorldMatrix();
    group3.origin = vec2.fromValues(group3.width/2, group3.height/2);
    group3.flushTransform(true);

    console.log(group2)
    const p = Ellipse({
        cx: 100,
        cy: 100,
        width: 20,
        height: 20,
        fill: 'red',
    });
    stage.addToStack(p);

    const rect8 = Rectangle({
        x: 500,
        y: 300,
        width: 180,
        height: 100,
        fill: 'purple',
        stroke: 'black',
        strokeWidth: 1,
        strokeLineDash: [1, 10]
    });
    stage.addToStack(rect8);

    const group4 = Group({ lock: false });
    stage.addToStack(group4);

    const rect77 = Rectangle({
        x: 0,
        y: 0,
        width: 200,
        height: 140,
        fill: 'rgb(255, 255, 0)',
        stroke: 'black',
        strokeWidth: 1,
    });
    const rect88 = Rectangle({
        x: 100,
        y: 50,
        width: 180,
        height: 100,
        fill: 'rgb(0, 255, 0)',
        stroke: 'black',
        strokeWidth: 1,
    });

    group4.addToStack(rect77);
    group4.addToStack(rect88);
    group4.updateWorldMatrix();
    group4.position = vec2.fromValues(200, 500);
    group4.origin = vec2.fromValues(group4.width/2, group4.height/2);
    group4.angle = 30;
    group4.flushTransform(true);*/
    // console.log(group2)
    
    
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
    //     // fill: 'rgb(0, 255, 255)',
    //     stroke: 'black',
    //     strokeWidth: 2,
    // })
    // stage.addToStack(path2);
    //  const path2 = Path({
    //     path: `M 10,30
    //        A 20,20 0,0,1 50,30
    //        A 20,20 0,0,1 90,30`,
    //     // fill: 'rgb(0, 255, 255)',
    //     stroke: 'black',
    //     strokeWidth: 2,
    // })
    // stage.addToStack(path2);

    
    // const rect = Rectangle({
    //     x: 20,
    //     y: 30,
    //     width: 180,
    //     height: 100,
    //     fill: 'rgb(0, 255, 255)',
    //     stroke: 'black',
    //     strokeWidth: 2,
    //     borderRadius: 12,
    //     rotation:  Math.PI/180*-90
    // });
    // stage.addToStack(rect);
    // rect.addEventListener('mouseenter', onMouseEnter)
    // rect.addEventListener('mouseleave', onMouseLeave)


    /* const rect1 = Rectangle({
        x: 100,
        y: 200,
        width: 480,
        height: 220,
        fill: 'rgb(0, 255, 255)',
        stroke: 'black',
        strokeWidth: 2,
        borderRadius: 12,
        // rotation:  Math.PI/180*-90
    });
    stage.addToStack(rect1);

    const rect2 = Rectangle({
        x: 0,
        y: 0,
        width: 220,
        height: 180,
        fill: 'red',
        stroke: 'black',
        strokeWidth: 2,
        borderRadius: 12,
        // rotation:  Math.PI/180*-90
    });
    const rect3 = Rectangle({
        x: 0,
        y: 0,
        width: 100,
        height: 180,
        fill: 'yellow',
        stroke: 'black',
        strokeWidth: 2,
        borderRadius: 12,
        // rotation:  Math.PI/180*-90
    });

    const group1 = Group();
    group1.setMask(rect2);
    group1.addToStack(rect2);
    group1.addToStack(rect3);
    group1.updateWorldMatrix();
    group1.origin = vec2.fromValues(group1.width/2, group1.height/2);
    group1.x = 120;
    group1.y = 220;
    group1.flushTransform();
    stage.addToStack(group1); */

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
    //         200, 20, 
    //         200, 200, 
    //         400, 300, 
    //         400, 400, 
    //         600, 500,
    //         200, 510
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
    //     // lineDash: [2, 10]
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
   
    /* fetch(
      '/assets/Ghostscript_Tiger.svg',
    ).then(async (res) => {
        const svg = await res.text();

        const $container = document.createElement('div');
        $container.innerHTML = svg;

        const $svg = $container.children[0];

        const group = Group({
            lock: true,
        });
        stage.addToStack(group);
        for (const child of $svg.children) {
            const attrs = fromSVGElement(child);
            console.log(attrs);
            deserializeNode(attrs, group);
        }
        group.updateWorldMatrix();
        group.position = vec2.fromValues(200, 0);
        group.origin = vec2.fromValues(group.width/2, group.height/2);
        group.flushTransform();
        group.updateWorldMatrix(stage.matrix);
    });

    function deserializeNode(data, parent) {
        const { type, attributes, children } = data;
        let shape;
        if (type === 'g') {
            shape = Group({ lock: true });
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
        if(type === 'g') {
            shape.updateWorldMatrix();
            shape.origin = vec2.fromValues(shape.width/2, shape.height/2);
            shape.flushTransform();
        }
        
    }

    /* fetch('/assets/PingFangSC-main/ttf/PingFangSC-Regular.ttf')
        .then(async res => {
            const buffer = await res.arrayBuffer();
            const font = opentype.parse(buffer);
            const para = Text({
                content: `WebGPU an API for performing operations, such as rendering
and computation, on a Graphics Processing Unit.
Graphics Processing Units, or `,
                x: 50,
                y: 400,
                fill: 'black',
                fontSize: 24,
                font,
            })
            stage.addToStack(para)
            stage.updateWorldMatrix();
            para.addEventListener('mouseenter', onMouseEnter)
            para.addEventListener('mouseleave', onMouseLeave)
        })*/

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
})();


(function() {
    // 从变换参数计算变换矩阵
    function updateLocalTransform(params) {
        const { _position, _scale, _pivot, _origin, _skew, _rotation } = params;
        const { _localTransform } = params;
        
        // 将角度转换为弧度
        const rad = _rotation * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        
        // 组合变换矩阵
        // 变换顺序: 平移到origin -> 平移pivot -> 缩放 -> skew -> 旋转 -> 平移-pivot -> 平移-origin -> 平移position
        
        // 计算最终的变换矩阵元素
        const a = cos * _scale[0];
        const b = sin * _scale[0];
        const c = -sin * _scale[1];
        const d = cos * _scale[1];
        
        // 添加skewX
        const finalA = a;
        const finalB = b;
        const finalC = c;
        const finalD = d;
        
        // 计算平移部分
        const pivotX = _pivot[0] + _origin[0];
        const pivotY = _pivot[1] + _origin[1];
        
        const tx = _position[0] - _origin[0] - (finalA * pivotX + finalC * pivotY - pivotX);
        const ty = _position[1] - _origin[1] - (finalB * pivotX + finalD * pivotY - pivotY);
        
        // 设置矩阵 (列主序)
        mat3.set(_localTransform,
            finalA, finalB, 0,
            finalC, finalD, 0,
            tx, ty, 1
        );
        
        return _localTransform;
    }

    // 从变换矩阵分解得到变换参数
    function decomposeLocalTransform(params) {
        const { _localTransform } = params;
        
        // 提取矩阵元素 (列主序)
        const a = _localTransform[0];
        const b = _localTransform[1];
        const c = _localTransform[3];
        const d = _localTransform[4];
        const tx = _localTransform[6];
        const ty = _localTransform[7];
        
        // 分解矩阵
        // 计算缩放和旋转
        const scaleX = Math.sqrt(a * a + b * b);
        const scaleY = Math.sqrt(c * c + d * d);
        
        // 计算旋转角度
        let rotation = Math.atan2(b, a) * 180 / Math.PI;
        
        // 归一化方向
        const signX = scaleX !== 0 ? 1 : 1;
        const signY = scaleY !== 0 ? (a * d - b * c < 0 ? -1 : 1) : 1;
        
        const finalScaleX = scaleX * signX;
        const finalScaleY = scaleY * signY;
        
        // 设置结果 (假设origin和pivot保持不变，只更新position)
        vec2.set(params._scale, finalScaleX, finalScaleY);
        params._rotation = rotation;
        
        // 计算position (考虑pivot和origin)
        const pivotX = params._pivot[0] + params._origin[0];
        const pivotY = params._pivot[1] + params._origin[1];
        
        const posX = tx + params._origin[0] + (a * pivotX + c * pivotY - pivotX);
        const posY = ty + params._origin[1] + (b * pivotX + d * pivotY - pivotY);
        
        vec2.set(params._position, posX, posY);
        
        return params;
    }

    // 使用示例
    const transformParams = {
        _position: vec2.fromValues(180, 90),
        _scale: vec2.fromValues(2, 15),
        _pivot: vec2.fromValues(10, 10),
        _origin: vec2.fromValues(20, 30),
        _rotation: 75,
        _localTransform: mat3.create()
    };

    // 从参数更新矩阵
    updateLocalTransform(transformParams);
    console.log('Transform Matrix:', transformParams._localTransform);

    // 从矩阵分解参数
    decomposeLocalTransform(transformParams);
    console.log('Position:', transformParams._position);
    console.log('Scale:', transformParams._scale);
    console.log('Rotation:', transformParams._rotation);
})();