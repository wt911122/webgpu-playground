struct GlobalUniforms {
    u_ProjectionMatrix: mat3x3f,
    u_ViewMatrix: mat3x3f,
    u_ViewProjectionInvMatrix: mat3x3f,
    u_ZoomScale: f32,
    u_AspectRatio: f32,
}
@group(0) @binding(0) var<uniform> gloabalUniforms: GlobalUniforms;

struct ShapeUniforms {
    zindexTop: f32,
}
@group(0) @binding(1) var<uniform> shapeUniforms: ShapeUniforms;

struct PerObjectUniforms {
    strokeWidth: f32,
    zindex: f32,
    strokeAlignment: f32,
    stroke: vec4f,
    dashed: vec4f,
    shapeMatrix: mat3x3f,
};
@group(1) @binding(0) var<uniform> obj: PerObjectUniforms;


const FILL: f32 = 1.0;
const BEVEL: f32 = 4.0;
const MITER: f32 = 8.0;
const ROUND: f32 = 12.0;
const JOINT_CAP_BUTT: f32 = 16.0;
const JOINT_CAP_SQUARE: f32 = 18.0;
const JOINT_CAP_ROUND: f32 = 20.0;
const FILL_EXPAND: f32 = 24.0;
const CAP_BUTT: f32 = 1.0;
const CAP_SQUARE: f32 = 2.0;
const CAP_ROUND: f32 = 3.0;
const CAP_BUTT2: f32 = 4.0;

const LEFT_POINT: u32 = 1;
const RIGHT_POINT: u32 = 2;

const expand: f32 = 1.0;
const dpr:f32 = 2.0;

struct Vertex {
    @location(1) prev: vec2f,
    @location(2) pointA: vec3f,
    @location(3) pointB: vec3f,
    @location(4) next: vec2f,
    @location(5) joint: f32,
    @location(6) num: f32,
    @location(7) travel: f32,
};


struct VertexOutput {
    @builtin(position) position : vec4f,
    // @location(0) fragPosition: vec2f,
    @location(1) arc: vec4f,
    @location(2) jointType: f32,
    @location(3) travel: f32,
    @location(4) distance: vec4f,
    @location(5) scalingFactor: f32,
    @location(6) strokeWidth: f32,
}

fn crossvec2(v1:vec2f, v2:vec2f) -> f32 {
    return v1.x * v2.y - v1.y * v2.x;
}

fn getInnerJoint(p: vec2f, pa: vec2f, pb: vec2f, LineWidth: f32) -> vec2f {
    let xBasis = pa - p;
    let len1 = length(xBasis);
    var norm = normalize(vec2f(-xBasis.y, xBasis.x));

    let xBasis2 = pb - p;
    let len2 = length(xBasis2);
    let norm2 = normalize(vec2f(xBasis2.y, -xBasis2.x));
    var bisect = (norm + norm2) / 2.0;
    let prod = bisect.x * norm.y - bisect.y * norm.x;
    if(prod < 0.0) {
        // 外侧
        bisect = -bisect;
        norm = -norm;
    } 
    let d = bisect / dot(norm, bisect) * LineWidth;
    if(length(d) > min(len1, len2)){
        return p + norm * LineWidth;
    }
    return  p + d;
}

fn getOuterJoint(p: vec2f, pa: vec2f, pb: vec2f, LineWidth: f32) -> vec2f {
    let xBasis = pa - p;
    var norm = normalize(vec2f(-xBasis.y, xBasis.x));

    let xBasis2 = pb - p;
    let norm2 = normalize(vec2f(xBasis2.y, -xBasis2.x));
    var bisect = (norm + norm2) / 2.0;
    let prod = bisect.x * norm.y - bisect.y * norm.x;
    if(prod > 0.0) {
        norm = -norm;
    } 
    return  p + norm * LineWidth;
}

fn getSegmentVertPos(p: vec2f, pa: vec2f, pb: vec2f, fact: f32, pdir: u32, LineWidth: f32) -> vec2f {
    var pos: vec2f;
    let xBasis = pa - p;
    let len1 = length(xBasis);
    let norm = normalize(vec2f(-xBasis.y * fact, xBasis.x * fact));

    let xBasis2 = pb - p;
    let len2 = length(xBasis2);
    let norm2 = normalize(vec2f(xBasis2.y * fact, -xBasis2.x * fact));
    var bisect = (norm + norm2) / 2.0;
    let prod = bisect.x * norm.y - bisect.y * norm.x;
    if(pdir == RIGHT_POINT) {
        // 线段右侧的点
        if(prod > 0.0) {
            // norm 在 bisect 的左侧
            pos = p + norm * LineWidth;
        } else {
            let d = bisect / dot(norm, bisect) * LineWidth;
            if(length(d) > min(len1, len2)){
                pos = p + norm * LineWidth;
            } else {
                pos = p + d;
            }
        }
    }
    
    if(pdir == LEFT_POINT) {
        // 线段左侧的点
        if(prod <= 0.0) {
            // norm 在 bisect 的左侧
            pos = p + norm * LineWidth;
        } else {
            let d = bisect / dot(norm, bisect) * LineWidth;
            if(length(d) > min(len1, len2)){
                return p + norm * LineWidth;
            } else {
                pos = p + d;
            }
        }
    }

    return pos;
}

fn getOuterBevel(p: vec2f, pa: vec2f, pb: vec2f, LineWidth: f32, BavelLimit: f32) -> vec2f {
    let xBasis = pa - p;
    var norm = normalize(vec2f(-xBasis.y, xBasis.x));

    let xBasis2 = pb - p;
    var norm2 = normalize(vec2f(xBasis2.y, -xBasis2.x));
    var bisect = (norm + norm2) / 2.0;
    let prod = bisect.x * norm.y - bisect.y * norm.x;
    if(prod > 0.0) {
        norm = -norm;
        norm2 = -norm2;
    } 
    var bisectline = bisect / dot(norm, bisect) * LineWidth;
    let len = length(bisectline);
    if(len > BavelLimit) {
        let theta = acos(clamp(dot(norm, norm2), -1.0, 1.0));
        var thetanb = theta/3;
        var rotatemat: mat2x2f;
        if(prod > 0.0) {
            rotatemat = mat2x2f(
                cos(thetanb), -sin(thetanb),
                sin(thetanb), cos(thetanb),
            );
        } else {
            thetanb = -thetanb;
            rotatemat = mat2x2f(
                cos(thetanb), -sin(thetanb),
                sin(thetanb), cos(thetanb),
            );
        }
        
        let nb = rotatemat*norm;
        // var nb = bisectline/len;
        let jp = p + nb * BavelLimit;
        return jp;
    }
    return  p + bisectline;
}



@vertex
fn vs(
   vert: Vertex,
   @builtin(instance_index) instanceIndex: u32
) -> VertexOutput {
    var output: VertexOutput;
    let zindexTop = shapeUniforms.zindexTop;
    var strokeWidth = obj.strokeWidth;
    // var strokeAlignment = obj.strokeAlignment;
    // let shift = strokeWidth/2 * strokeAlignment;
    var LineWidth = strokeWidth/2;//+1.0;
    var bavelLimit =  LineWidth*1.5;
    var joint = vert.joint;
    var distance = vec4f(0.0, 0.0, 0.0, strokeWidth);
    output.strokeWidth = strokeWidth;
    // var strokeAlignment: f32 = 0.5;
    // var strokeMiterlimit: f32 = 4.0;
    // var strokeAlignmentFactor = 2.0 * strokeAlignment - 1.0;
    var vertexNum = vert.num;
    

    var modelMatrix = obj.shapeMatrix;
    var pos: vec2f;

    var PAjoint = vert.pointA.z;
    var PBjoint = vert.pointB.z;
    if(PAjoint == 0 || PBjoint == 0) {
        output.travel = 0;
        output.position = vec4f(0,0,0,0);
        return output;
    }

    /*
    合并实现
    */
    var pointPrev = (modelMatrix * vec3f(vert.prev, 1.0)).xy;
    var pointA = (modelMatrix * vec3f(vert.pointA.xy, 1.0)).xy;
    var pointB = (modelMatrix * vec3f(vert.pointB.xy, 1.0)).xy;
    var pointNext = (modelMatrix * vec3f(vert.next, 1.0)).xy;

    let vecAB = pointA - pointB;
    let normAB = normalize(vec2f(-vecAB.y, vecAB.x));

    if(vertexNum > -0.5 && vertexNum < 3.5) {
        // 线段
        if(vertexNum < 0.5){
            pos = getSegmentVertPos(pointA, pointB, pointPrev, 1.0, LEFT_POINT, LineWidth);
            distance.x = LineWidth;
        } else if(vertexNum < 1.5) {
            pos = getSegmentVertPos(pointB, pointA, pointNext, -1.0, RIGHT_POINT, LineWidth);
            distance.x = LineWidth;
        } else if(vertexNum < 2.5) {
            pos = getSegmentVertPos(pointB, pointA, pointNext, 1.0, LEFT_POINT, LineWidth);
            distance.x = -LineWidth;
        } else if(vertexNum < 3.5) {
            pos = getSegmentVertPos(pointA, pointB, pointPrev, -1.0, RIGHT_POINT, LineWidth);
            distance.x = -LineWidth;
        }
        output.jointType = 0.0;
    } else {
         if (vertexNum < 4.5) {
            // #4
            pos = getInnerJoint(pointB, pointA, pointNext, LineWidth);
        } else if (vertexNum < 5.5) {
            // #5
            pos = getOuterJoint(pointB, pointA, pointNext, LineWidth);//getSegmentVertPos(pointB, pointA, pointNext, -1.0, RIGHT_POINT, LineWidth);
        }

        if(vertexNum > 7.5) {
            // #8
            pos = getOuterJoint(pointB, pointNext, pointA, LineWidth);//getSegmentVertPos(pointB, pointNext, pointA, 1.0, LEFT_POINT, LineWidth);
        }


        if(vertexNum > 5.5 && vertexNum < 6.5) {
            // #6
            pos = getOuterBevel(pointB, pointA, pointNext, LineWidth, LineWidth);//pointB; //+ bisect * LineWidth;

        }

        if(vertexNum > 6.5 && vertexNum < 7.5) {
            // #7
            pos = getOuterBevel(pointB, pointNext, pointA, LineWidth, LineWidth); //+ bisect * LineWidth;
        }
    }


    /*
        普通实现
    */
    /*
    var p: vec2f;
    if(vertexNum < 0.5) {
        p = vec2f(0.0, -.5);
    } else if(vertexNum < 1.5) {
        p = vec2f(1.0, -.5);
    } else if(vertexNum < 2.5) {
        p = vec2f(1.0, 0.5);
    } else if(vertexNum < 3.5) {
        p = vec2f(0.0, 0.5);
    }

    let xBasis = pointB - pointA;
    let yBasis = normalize(vec2f(-xBasis.y, xBasis.x));
    pos = pointA 
        + xBasis * p.x
        + yBasis * strokeWidth * p.y;
        */
    // output.distance = vec4(d, LineWidth, dy2, dy3, );
    // pos = vec2f(vertexNum * vertexNum * 80, vertexNum * 50);
    // output.position = vec4f(vertexNum*0.1, vertexNum*0.15, 0.1, 1);
    // pos += normAB * shift;
    let xBasis = pointB - pointA;
    let forward = normalize(xBasis);
    let norm = vec2(forward.y, -forward.x);
    output.travel = vert.travel + dot(pos - pointA, vec2(-norm.y, norm.x));

    output.position = vec4f((gloabalUniforms.u_ProjectionMatrix
        * gloabalUniforms.u_ViewMatrix
        * vec3f(pos, 1)).xy, (zindexTop - obj.zindex - 1)/zindexTop, 1);
    // output.fragPosition = pos;
    return output;
}

fn pixelLine(x: f32) -> f32 {
	return clamp(x + 0.5, 0., 1.);
} 

const epsilon: f32 = 0.000001;
@fragment
fn fs(fragData: VertexOutput) -> @location(0) vec4f {
    // let strokeColor: vec4<f32> = vec4f(0,0,0,1.0);// u_StrokeColor;
	// var outputColor = strokeColor;
    // if(fragData.travel % 2 == 0) {
    //     return  vec4f(0.0, 1.0, 0, 1.0);
    // }
    if(fragData.travel == 0) {
        discard;
    }
    var outputColor = obj.stroke;
    let jointType = fragData.jointType;
    let distance = fragData.distance;
    let d = distance.x;
    let w = distance.w;
    // var alpha: f32 = 1.0;
    var result: f32 = 0.0;

    if(jointType < 0.5 ) {
        let left = pixelLine(d-w);
        let right = pixelLine(d+w);
        result = (right-left);
    }

    /*if(jointType == 0.0) {
        // 线段
        let left = pixelLine(d-w);
        let right = pixelLine(d+w);
        dist = (right-left);
    }
    if(jointType == 1.0) {
        // mitter joint
        let a1 = pixelLine(d1 - w);
        let a2 = pixelLine(d1 + w);
        let b1 = pixelLine(d2 - w);
        let b2 = pixelLine(d2 + w);
        dist = (a2 * b2 - a1 * b1);
    }
    if(jointType == 2.0) {
        // bevel joint
        let a1 = pixelLine(d1 - w);
        let a2 = pixelLine(d1 + w);
        let b1 = pixelLine(d2 - w);
        let b2 = pixelLine(d2 + w);
        dist = min(a2 * b2 - a1 * b1, pixelLine(d3));
    }
    if(jointType == 3.0) {
        // round
        // let a1 = pixelLine(d1 - w);
        // let a2 = pixelLine(d1 + w);
        // let b1 = pixelLine(d2 - w);
        // let b2 = pixelLine(d2 + w);
        // let alpha_miter = a2 * b2 - a1 * b1;
        // let alpha_bevel = pixelLine(d3);
        // let r = length(circle.xy);
        // let circle_hor = pixelLine(w + r) - pixelLine(-w + r);
        // let circle_vert = min(w * 2.0, 1.0);
        // let alpha_circle = circle_hor * circle_vert;
        // alpha *= min(alpha_miter, max(alpha_circle, alpha_bevel));
    }*/
    let Dash = obj.dashed.x;
    let Gap = obj.dashed.y;
    let DashOffset = obj.dashed.z;
    var alpha = 1.0;
    if (Dash + Gap > 1.0) {
        let travel = (fragData.travel + Gap * 0.5 + DashOffset) % (Dash + Gap) - (Gap * 0.5);
        let left = max(travel - 0.5, -0.5);
        let right = min(travel + 0.5, Gap + 0.5);
        alpha *= (max(0.0, right - left));
    }
    
    // var alpha = antialias(dist) * ;
    outputColor *= alpha;
    return outputColor;

    // if(fragData.travel < 3.5) {
    //     return  vec4f(0.0, 1.0, 0, 1.0);
    // }
    // return vec4f(1.0, 0, 0, 1.0);
}

fn antialias(distance: f32) -> f32 {
	return clamp(distance / fwidth(distance), 0., 1.);
} 

