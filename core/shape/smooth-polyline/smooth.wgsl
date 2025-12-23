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

const MITER_LIMIT: f32 = 10.0;

const expand: f32 = 1.0;

struct Vertex {
    @location(1) prev: vec2f,
    @location(2) pointA: vec2f,
    @location(3) pointB: vec2f,
    @location(4) next: vec2f,
    @location(5) joint: f32,
    @location(6) travel: f32,
};


struct VertexOutput {
    @builtin(position) position : vec4f,
    // @location(0) fragPosition: vec2f,
    @location(1) vArc: vec4f,
    @location(2) vType: f32,
    @location(3) vLine1: vec4f,
    @location(4) vLine2: vec4f,
    @location(5) vTravel: f32,
}


fn doBisect( norm: vec2f, len: f32, norm2: vec2f, len2:f32, dy: f32, inner: f32) -> vec2f {
    var bisect = (norm + norm2) / 2.0;
    bisect /= dot(norm, bisect);
    var shift = dy * bisect;
    if (inner > 0.5) {
        if (len < len2) {
            if (abs(dy * (bisect.x * norm.y - bisect.y * norm.x)) > len) {
                return dy * norm;
            }
        } else {
            if (abs(dy * (bisect.x * norm2.y - bisect.y * norm2.x)) > len2) {
                return dy * norm;
            }
        }
    }
    return dy * bisect;
}


@vertex
fn vs(
   vert: Vertex,
) -> VertexOutput {
    let zindexTop = shapeUniforms.zindexTop;
    
    var output: VertexOutput;
    var modelMatrix = obj.shapeMatrix;
    var pointPrev = (modelMatrix * vec3f(vert.prev, 1.0)).xy;
    var pointA = (modelMatrix * vec3f(vert.pointA.xy, 1.0)).xy;
    var pointB = (modelMatrix * vec3f(vert.pointB.xy, 1.0)).xy;
    var pointNext = (modelMatrix * vec3f(vert.next, 1.0)).xy;



    var xBasis = pointB - pointA;
    var len = length(xBasis);
    var forward = xBasis / len;
    var norm = vec2f(forward.y, -forward.x);

    var jointType = floor(vert.joint / 16.0);
    var vertexNum = vert.joint - jointType * 16.0;
    var dx:f32 = 0.0;
    var dy:f32 = 1.0;

    var capType = floor(jointType / 32.0);
    jointType -= capType * 32.0;

    var strokeWidth = obj.strokeWidth;
    var lineWidth = strokeWidth/2;
    lineWidth *= 0.5;
    var lineAlignment:f32 = 0.0;

    var pos: vec2f;
    if (capType == CAP_ROUND) {
        vertexNum += 4.0;
        jointType = JOINT_CAP_ROUND;
        capType = 0.0;
        lineAlignment = -lineAlignment;
    }

    var vLine1 = vec4f(0.0, 10.0, 1.0, 0.0);
    var vLine2 = vec4f(0.0, 10.0, 1.0, 0.0);
    var vArc = vec4f(0.0);
    var vType:f32 = 0.0;
    var vTravel: f32 = 0.0;

    if (jointType == FILL) {
        pos = pointA;
        vType = 0.0;
        vLine2 = vec4f(-2.0, -2.0, -2.0, 0.0);
        
    } else if (jointType >= FILL_EXPAND && jointType < FILL_EXPAND + 7.5) {
        var flags = jointType - FILL_EXPAND;
        var flag3 = floor(flags / 4.0);
        var flag2 = floor((flags - flag3 * 4.0) / 2.0);
        var flag1 = flags - flag3 * 4.0 - flag2 * 2.0;

        var prev = pointPrev;

        if (vertexNum < 0.5) {
            pos = prev;
        } else if (vertexNum < 1.5) {
            pos = pointA;
        } else {
            pos = pointB;
        }
        var len2 = length(vert.next);
        var bisect = pointNext;
        if (len2 > 0.01) {
            bisect = normalize(bisect) * len2;
        }

        var n1 = normalize(vec2f(pointA.y - prev.y, -(pointA.x - prev.x)));
        var n2 = normalize(vec2f(pointB.y - pointA.y, -(pointB.x - pointA.x)));
        var n3 = normalize(vec2f(prev.y - pointB.y, -(prev.x - pointB.x)));

        if (n1.x * n2.y - n1.y * n2.x < 0.0) {
            n1 = -n1;
            n2 = -n2;
            n3 = -n3;
        }
        pos += bisect * expand;

        vLine1 = vec4f(16.0, 16.0, 16.0, -1.0);
        if (flag1 > 0.5) {
            vLine1.x = -dot(pos - prev, n1);
        }
        if (flag2 > 0.5) {
            vLine1.y = -dot(pos - pointA, n2);
        }
        if (flag3 > 0.5) {
            vLine1.z = -dot(pos - pointB, n3);
        }
        vType = 2.0;
    } else if (jointType >= BEVEL) {
        var dy = lineWidth + expand;
        var shift = lineWidth * lineAlignment;
        var inner = 0.0;
        if (vertexNum >= 1.5) {
            dy = -dy;
            inner = 1.0;
        }

        var base: vec2f;
        var next: vec2f;
        var xBasis2: vec2f;
        var bisect: vec2f;
        var flag = 0.0;
        var side2 = 1.0;
        if (vertexNum < 0.5 || (vertexNum > 2.5 && vertexNum < 3.5)) {
            next = pointPrev;
            base = pointA;
            flag = jointType - floor(jointType / 2.0) * 2.0;
            side2 = -1.0;
        } else {
            next = pointNext;
            base = pointB;
            if (jointType >= MITER && jointType < MITER + 3.5) {
                flag = step(MITER + 1.5, jointType);
                // check miter limit here?
            }
        }
        xBasis2 = next - base;
        var len2 = length(xBasis2);
        var norm2 = vec2f(xBasis2.y, -xBasis2.x) / len2;
        var D = norm.x * norm2.y - norm.y * norm2.x;
        if (D < 0.0) {
            inner = 1.0 - inner;
        }

        norm2 *= side2;

        var collinear = step(0.0, dot(norm, norm2));

        vType = 0.0;
        var dy2 = -1000.0;

        if (abs(D) < 0.01 && collinear < 0.5) {
            if (jointType >= ROUND && jointType < ROUND + 1.5) {
                jointType = JOINT_CAP_ROUND;
            }
            //TODO: BUTT here too
        }

        vLine1 = vec4f(0.0, lineWidth, max(abs(norm.x), abs(norm.y)), min(abs(norm.x), abs(norm.y)));
        vLine2 = vec4f(0.0, lineWidth, max(abs(norm2.x), abs(norm2.y)), min(abs(norm2.x), abs(norm2.y)));

        if (vertexNum < 3.5) {
            if (abs(D) < 0.01 && collinear < 0.5) {
                pos = (shift + dy) * norm;
            } else {
                if (flag < 0.5 && inner < 0.5) {
                    pos = (shift + dy) * norm;
                } else {
                    pos = doBisect(norm, len, norm2, len2, shift + dy, inner);
                }
            }
            vLine2.y = -1000.0;
            if (capType >= CAP_BUTT && capType < CAP_ROUND) {
                var extra = step(CAP_SQUARE, capType) * lineWidth;
                var back = -forward;
                if (vertexNum < 0.5 || vertexNum > 2.5) {
                    pos += back * (expand + extra);
                    dy2 = expand;
                } else {
                    dy2 = dot(pos + base - pointA, back) - extra;
                }
            }
            if (jointType >= JOINT_CAP_BUTT && jointType < JOINT_CAP_SQUARE + 0.5) {
                var extra = step(JOINT_CAP_SQUARE, jointType) * lineWidth;
                if (vertexNum < 0.5 || vertexNum > 2.5) {
                    vLine2.y = dot(pos + base - pointB, forward) - extra;
                } else {
                    pos += forward * (expand + extra);
                    vLine2.y = expand;
                    if (capType >= CAP_BUTT) {
                        dy2 -= expand + extra;
                    }
                }
            }
        } else if (jointType >= JOINT_CAP_ROUND && jointType < JOINT_CAP_ROUND + 1.5) {
            base += shift * norm;
            if (inner > 0.5) {
                dy = -dy;
                inner = 0.0;
            }
            var d2 = abs(dy) * forward;
            if (vertexNum < 4.5) {
                dy = -dy;
                pos = dy * norm;
            } else if (vertexNum < 5.5) {
                pos = dy * norm;
            } else if (vertexNum < 6.5) {
                pos = dy * norm + d2;
                vArc.x = abs(dy);
            } else {
                dy = -dy;
                pos = dy * norm + d2;
                vArc.x = abs(dy);
            }
            vLine2 = vec4f(0.0, lineWidth * 2.0 + 10.0, 1.0  , 0.0); // forget about line2 with jointType=3
            vArc.y = dy;
            vArc.z = 0.0;
            vArc.w = lineWidth;
            vType = 3.0;
        } else if (abs(D) < 0.01 && collinear < 0.5) {
            pos = dy * norm;
        } else {
            if (inner > 0.5) {
                dy = -dy;
                inner = 0.0;
            }
            var side = sign(dy);
            var norm3 = normalize(norm + norm2);

            if (jointType >= MITER && jointType < MITER + 3.5) {
                var farVertex = doBisect(norm, len, norm2, len2, shift + dy, 0.0);
                if (length(farVertex) > abs(shift + dy) * MITER_LIMIT) {
                    jointType = BEVEL;
                }
            }

            if (vertexNum < 4.5) {
                pos = doBisect(norm, len, norm2, len2, shift - dy, 1.0);
            } else if (vertexNum < 5.5) {
                pos = (shift + dy) * norm;
            } else if (vertexNum > 7.5) {
                pos = (shift + dy) * norm2;
            } else {
                if (jointType >= ROUND && jointType < ROUND + 1.5) {
                    pos = doBisect(norm, len, norm2, len2, shift + dy, 0.0);
                    var d2 = abs(shift + dy);
                    if (length(pos) > abs(shift + dy) * 1.5) {
                        if (vertexNum < 6.5) {
                            pos.x = (shift + dy) * norm.x - d2 * norm.y;
                            pos.y = (shift + dy) * norm.y + d2 * norm.x;
                        } else {
                            pos.x = (shift + dy) * norm2.x + d2 * norm2.y;
                            pos.y = (shift + dy) * norm2.y - d2 * norm2.x;
                        }
                    }
                } else if (jointType >= MITER && jointType < MITER + 3.5) {
                    pos = doBisect(norm, len, norm2, len2, shift + dy, 0.0); //farVertex
                } else if (jointType >= BEVEL && jointType < BEVEL + 1.5) {
                    var d2 = side;
                    if (vertexNum < 6.5) {
                        pos = (shift + dy) * norm + d2 * norm3;
                    } else {
                        pos = (shift + dy) * norm2 + d2 * norm3;
                    }
                }
            }

            if (jointType >= ROUND && jointType < ROUND + 1.5) {
                vArc.x = side * dot(pos, norm3);
                vArc.y = pos.x * norm3.y - pos.y * norm3.x;
                vArc.z = dot(norm, norm3) * (lineWidth + side * shift);
                vArc.w = lineWidth + side * shift;
                vType = 3.0;
            } else if (jointType >= MITER && jointType < MITER + 3.5) {
                vType = 1.0;
            } else if (jointType >= BEVEL && jointType < BEVEL + 1.5) {
                vType = 4.0;
                vArc.z = dot(norm, norm3) * (lineWidth + side * shift) - side * dot(pos, norm3);
            }

            dy = side * (dot(pos, norm) - shift);
            dy2 = side * (dot(pos, norm2) - shift);
        } 

        pos += base;
        vLine1.x = dy;
        vLine2.x = dy2;
        vTravel = vert.travel + dot(pos - pointA, vec2f(-norm.y, norm.x));
    }

    output.position = vec4f((gloabalUniforms.u_ProjectionMatrix
        * gloabalUniforms.u_ViewMatrix
        * vec3f(pos, 1)).xy, (zindexTop - obj.zindex - 1)/zindexTop, 1);
    output.vTravel = vTravel;
    output.vArc = vArc;
    output.vType = vType;
    output.vLine1 = vLine1;
    output.vLine2 = vLine2;
    return output;
}

fn pixelLine(x: f32, A: f32, B: f32) -> f32 {
    // var y = abs(x);
    // var s = sign(x);
    // if (y * 2.0 < A - B) {
    //     return 0.5 + s * y / A;
    // }
    // y -= (A - B) * 0.5;
    // y = max(1.0 - y / B, 0.0);
    // return (1.0 + s * (1.0 - y * y)) * 0.5;
    return clamp(x + 0.5, 0.0, 1.0);
}

@fragment
fn fs(fragData: VertexOutput) -> @location(0) vec4f {
    var alpha: f32 = 1.0;
    var vType = fragData.vType;
    var vLine1 = fragData.vLine1;
    var vLine2 = fragData.vLine2;
    var vArc = fragData.vArc;
    var vTravel = fragData.vTravel;
    var strokeColor = vec4f(obj.stroke.rgb * obj.stroke.a / 255.0, obj.stroke.a); 

    if (vType < 0.5) {
        var left = pixelLine(-vLine1.y - vLine1.x, vLine1.z, vLine1.w);
        var right = pixelLine(vLine1.y - vLine1.x, vLine1.z, vLine1.w);
        var near = vLine2.x - 0.5;
        var far = min(vLine2.x + 0.5, 0.0);
        var top = vLine2.y - 0.5;
        var bottom = min(vLine2.y + 0.5, 0.0);
        alpha = (right - left) * max(bottom - top, 0.0) * max(far - near, 0.0);
    } else if (vType < 1.5) {
        var a1 = pixelLine(- vLine1.y - vLine1.x, vLine1.z, vLine1.w);
        var a2 = pixelLine(vLine1.y - vLine1.x, vLine1.z, vLine1.w);
        var b1 = pixelLine(- vLine2.y - vLine2.x, vLine2.z, vLine2.w);
        var b2 = pixelLine(vLine2.y - vLine2.x, vLine2.z, vLine2.w);
        alpha = a2 * b2 - a1 * b1;
    } else if (vType < 2.5) {
        alpha *= max(min(vLine1.x + 0.5, 1.0), 0.0);
        alpha *= max(min(vLine1.y + 0.5, 1.0), 0.0);
        alpha *= max(min(vLine1.z + 0.5, 1.0), 0.0);
    } else if (vType < 3.5) {
        var a1 = pixelLine(- vLine1.y - vLine1.x, vLine1.z, vLine1.w);
        var a2 = pixelLine(vLine1.y - vLine1.x, vLine1.z, vLine1.w);
        var b1 = pixelLine(- vLine2.y - vLine2.x, vLine2.z, vLine2.w);
        var b2 = pixelLine(vLine2.y - vLine2.x, vLine2.z, vLine2.w);
        var alpha_miter = a2 * b2 - a1 * b1;
        var alpha_plane = clamp(vArc.z - vArc.x + 0.5, 0.0, 1.0);
        var d = length(vArc.xy);
        var circle_hor = max(min(vArc.w, d + 0.5) - max(-vArc.w, d - 0.5), 0.0);
        var circle_vert = min(vArc.w * 2.0, 1.0);
        var alpha_circle = circle_hor * circle_vert;
        alpha = min(alpha_miter, max(alpha_circle, alpha_plane));
    } else {
        var a1 = pixelLine(- vLine1.y - vLine1.x, vLine1.z, vLine1.w);
        var a2 = pixelLine(vLine1.y - vLine1.x, vLine1.z, vLine1.w);
        var b1 = pixelLine(- vLine2.y - vLine2.x, vLine2.z, vLine2.w);
        var b2 = pixelLine(vLine2.y - vLine2.x, vLine2.z, vLine2.w);
        alpha = a2 * b2 - a1 * b1;
        alpha *= clamp(vArc.z + 0.5, 0.0, 1.0);
    }
    if(alpha < 0.5) {
        discard;
    }
    strokeColor *= alpha;
    return strokeColor;
}



