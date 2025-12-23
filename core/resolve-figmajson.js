function toFixed (str) {
    return str.toFixed(0);
}
function extractColor(json) {
    if(json && json.type === 'GRADIENT_LINEAR') {
        return {
            type: 'GRADIENT_LINEAR',
            colorstops: json.gradientStops.map(c => ({
                offset: c.position,
                color: `rgba(${toFixed(c.color.r * 255)}, ${toFixed(c.color.g * 255)}, ${toFixed(c.color.b * 255)}, ${c.color.a})`,
            }))
        }
    }
    if(json && json.type === 'SOLID' && json.visible !== false && json.color) {
        return {
            type: 'SOLID',
            color: `rgba(${toFixed(json.color.r * 255)}, ${toFixed(json.color.g * 255)}, ${toFixed(json.color.b * 255)}, ${json.color.a * (json.opacity ?? 1)})`
        }
    }
       
    return {
        type: 'UNKNOWN'
    }
}
function extractRotation(rotate) {
    return rotate// -Math.PI/180 * rotate;
}

function extractStrokeWidth(json) {
    if(json.individualStrokeWeights) {
        const t = json.individualStrokeWeights;
        return [t.left, t.top, t.right, t.bottom]
    }
    const q = json.strokes.length ? json.strokeWeight : 0;
    return [q,q,q,q];
}

function extractBorderRadius(json) {
    if(json.rectangleCornerRadii) {
        const t = json.rectangleCornerRadii;
        return [t[0], t[1], t[3], t[2]]
    }
    const radius = json.cornerRadius ?? 0;
    return [radius, radius, radius, radius]
}

export function iterator(json, t, parentAbsPos = { x:0, y: 0}) {
    if(json.visible === false || json.opacity === 0) {
        return;
    }
    let type = json.type;
    const {x, y} = json.absoluteBoundingBox;
    const {x: width, y: height} = json.size;
    let relativeX = x - parentAbsPos.x;
    const relativeY = y - parentAbsPos.y;
    t.id = json.id;
    // if(json.constraints.horizontal === 'LEFT_RIGHT') {
    //     relativeX = parentAbsPos.width/2;
    //     console.log(relativeX)
    // }
    //  if(json.constraints.vertical === 'TOP') {
    //     relativeX = parentAbsPos.width/2;
    //     console.log(relativeX)
    // }
    if(type === 'INSTANCE' || type === 'FRAME' || type === 'GROUP' || type === 'BOOLEAN_OPERATION') {
        Object.assign(t, {
            type: 'Group',
            x: relativeX,
            y: relativeY,
            relativeTransform: json.relativeTransform,
            clipsContent: (json.clipsContent || type === 'BOOLEAN_OPERATION')
        });
        if(type === 'BOOLEAN_OPERATION') {
            t.children = [
                {
                    type: 'GroupPath',
                    x: relativeX,
                    y: relativeY,
                    width, height,
                    opacity: json.opacity,
                    paths: [
                        ...json.fillGeometry.map(p => ({ data: p.path, type: 'fill' })),
                        ...json.strokeGeometry.map(p => ({ data: p.path, type: 'stroke' }))
                    ],
                    strokeWidth: json.strokeWeight,
                    rotation: json.rotation ? extractRotation(json.rotation) : 0,
                    fill: extractColor(json.fills[0]),
                    stroke: extractColor(json.strokes[0]),
                    relativeTransform: [[1,0,0],[0,1,0]],
                    effects: json.effects,
                    id: json.id,
                }
            ]
        } else {
            t.children = [
                {
                    type: type === 'FRAME' ? 'FrameRectangle' : 'GroupRectangle',
                    x: 0, y: 0,
                    width, height,
                    opacity: json.opacity,
                    fill: extractColor(json.fills[0]),
                    stroke: extractColor(json.strokes[0]),
                    rotation: json.rotation ? extractRotation(json.rotation) : 0,
                    strokeWidth: extractStrokeWidth(json),
                    borderRadius: extractBorderRadius(json),
                    constraints: json.constraints,
                    relativeTransform: [[1,0,0],[0,1,0]],
                    id: json.id,
                }
            ]
        }


    } else if(type === 'RECTANGLE') {
        type = 'Rectangle';
        const size = json.size;
        const absoluteRenderBounds = json.absoluteRenderBounds || json.absoluteBoundingBox;
        Object.assign(t, {
            type,
            x: absoluteRenderBounds.x - parentAbsPos.x,
            y: absoluteRenderBounds.y - parentAbsPos.y,
            width: size.x, 
            height: size.y,
            opacity: json.opacity,
            fill: extractColor(json.fills[0]),
            stroke: extractColor(json.strokes[0]),
            rotation: 0, //extractRotation(json.rotation),
            strokeWidth: extractStrokeWidth(json),
            borderRadius: extractBorderRadius(json),
            constraints: json.constraints,
            relativeTransform: json.relativeTransform,
        });
        
    } else if(type === 'VECTOR') {
        type = 'Path';
        Object.assign(t, {
            type,
            x: relativeX,
            y: relativeY,
            width, height,
            opacity: json.opacity,
            paths: [
                ...json.fillGeometry.map(p => ({ data: p.path, type: 'fill' })),
                ...json.strokeGeometry.map(p => ({ data: p.path, type: 'stroke' }))
            ],
            strokeWidth: json.strokeWeight,
            rotation: json.rotation ? extractRotation(json.rotation) : 0,
            fill: extractColor(json.fills[0]),
            stroke: extractColor(json.strokes[0]),
            relativeTransform: json.relativeTransform,
            effects: json.effects
        });
    } else if(type === 'TEXT') {
        type = 'Text';
        Object.assign(t, {
            type,
            x: relativeX,
            y: relativeY,
            width, height,
            content: json.characters,
            fontSize: json.style.fontSize,
            textAlignHorizontal: json.style.textAlignHorizontal,
            textAlignVertical: json.style.textAlignVertical,
            lineHeight: json.style.lineHeightPx,
            opacity: json.opacity,
            color: extractColor(json.fills[0]),
            rotation: json.rotation ? extractRotation(json.rotation) : 0,
            autoWrap: json.style.textAutoResize === "HEIGHT",
            ellipseEnd: json.style.textTruncation === "ENDING",
            relativeTransform: json.relativeTransform,
        });
    } else if(type === 'ELLIPSE') {
        type = 'ELLIPSE';
        Object.assign(t, {
            type,
            x: relativeX + json.size.x/2,
            y: relativeY + json.size.y/2,
            width: json.size.x, 
            height: json.size.y,
            opacity: json.opacity,
            fill: extractColor(json.fills[0]),
            stroke: extractColor(json.strokes[0]),
            rotation: 0, //extractRotation(json.rotation),
            strokeWidth: json.strokeWeight,
            borderRadius: extractBorderRadius(json),
            constraints: json.constraints,
            relativeTransform: json.relativeTransform,
        });
    } else {
        console.log(type)
    }
    
   
    if(json.children && t.children) {
        const children = json.children.filter(c => c.visible !== false);
        if(children.length) {
            children.forEach((c) => {
                const q = {};
                t.children.push(q);
                iterator(c, q, json.absoluteBoundingBox)
            });
        }
        // const children = [];

        // t.children = children.concat(t.children);
    }
    
}