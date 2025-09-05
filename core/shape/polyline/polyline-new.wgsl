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

struct PerLineUniforms {
    strokeWidth: f32,
    zindex: f32,
    fill: vec4f,
    stroke: vec4f,
    shapeMatrix: mat3x3f,
}
@group(1) @binding(0) var<uniform> lineUniforms: PerLineUniforms;


const FILL: f32 = 1.0;
const BEVEL: f32 = 4.0;
const MITER: f32 = 8.0;
const ROUND: f32 = 12.0;
const JOINT_CAP_BUTT: f32 = 12.0;
const JOINT_CAP_SQUARE: f32 = 16.0;
const JOINT_CAP_ROUND: f32 = 18.0;
const FILL_EXPAND: f32 = 20.0;
const CAP_BUTT: f32 = 1.0;
const CAP_SQUARE: f32 = 2.0;
const CAP_ROUND: f32 = 3.0;
const CAP_BUTT2: f32 = 4.0;

const expand: f32 = 1.0;
const dpr:f32 = 2.0;

struct Vertex {
    @location(1) prev: vec2f,
    @location(2) pointA: vec2f,
    @location(3) pointB: vec2f,
    @location(4) next: vec2f,
    @location(5) joint: f32,
    @location(6) num: f32,
    @location(7) travel: f32,
};


struct VertexOutput {
    @builtin(position) position : vec4f,
    @location(0) fragPosition: vec2f,
    @location(1) arc: vec4f,
    @location(2) jointType: f32,
    @location(3) travel: f32,
    @location(4) distance: vec4f,
    @location(5) scalingFactor: f32,
}

fn doBisect(
    norm: vec2f, 
    len: f32, 
    norm2: vec2f,
    len2: f32, 
    dy: f32, 
    inner: f32
) -> vec2f {
    var bisect = (norm + norm2) / 2.0;
    bisect /= dot(norm, bisect);
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
   vert: Vertex
) -> VertexOutput {
    var output: VertexOutput;
    let zindexTop = shapeUniforms.zindexTop;
    var strokeWidth: f32 = lineUniforms.strokeWidth;
    var strokeAlignment: f32 = 0.5;
    var strokeMiterlimit: f32 = 4.0;

    var modelMatrix = mat3x3f(
        1.0, 0.0, 0.0,
        0.0, 1.0, 0.0,
        0.0, 0.0, 1.0
    );
    
    var pointA = (modelMatrix * vec3f(vert.pointA, 1.0)).xy;
    var pointB = (modelMatrix * vec3f(vert.pointB, 1.0)).xy;

    var xBasis = pointB - pointA;
    var len = length(xBasis);
    var forward = xBasis / len;
    var norm = vec2f(forward.y, -forward.x);
    
    var jointType = vert.joint;
    var vertexNum = vert.num;

    var capType = floor(jointType / 32.0);
    jointType -= capType * 32.0;
    output.arc = vec4(0.0);
    strokeWidth *= 0.5;
    var strokeAlignmentFactor: f32 = 2.0 * strokeAlignment - 1.0;


    var pos: vec2f;
    if (capType == CAP_ROUND) {
        if (vertexNum < 3.5) {
            output.position = vec4f(0.0, 0.0, 0.0, 1.0);
            return output;
        }
        jointType = JOINT_CAP_ROUND;
        capType = 0.0;
    }
    if (jointType >= BEVEL) {
        var dy = strokeWidth + expand;
        var inner = 0.0;
        if (vertexNum >= 1.5) {
            dy = -dy;
            inner = 1.0;
        }
        var flag = 0.0;
        var sign2 = 1.0;
        var base: vec2f;
        var next: vec2f;
        var xBasis2: vec2f;
        var bisect: vec2f;

        if (vertexNum < 0.5 || (vertexNum > 2.5 && vertexNum < 3.5)) {
            base = pointA;
            flag = jointType - floor(jointType / 2.0) * 2.0;
            sign2 = -1.0;
        } else {
            next = (modelMatrix * vec3f(vert.next, 1.0)).xy;
            base = pointB;
            if (jointType >= MITER && jointType < MITER + 3.5) {
                flag = step(MITER + 1.5, jointType);
                // check miter limit here?
            }
        }

        xBasis2 = next - base;
        let len2 = length(xBasis2);
        var norm2 = vec2(xBasis2.y, -xBasis2.x) / len2;
        let D = norm.x * norm2.y - norm.y * norm2.x;
        if (D < 0.0) {
            inner = 1.0 - inner;
        }
        norm2 *= sign2;

       if (abs(strokeAlignmentFactor) > 0.01) {
			let shift: f32 = strokeWidth * strokeAlignmentFactor;
			pointA = pointA + (norm * shift);
			pointB = pointB + (norm * shift);
			if (abs(D) < 0.01) {
				base = base + (norm * shift);
			} else { 
				base = base + (doBisect(norm, len, norm2, len2, shift, 0.));
			}
		}
		let collinear: f32 = step(0., dot(norm, norm2));
		output.jointType = 0.;
		var dy2: f32 = -1000.;
		var dy3: f32 = -1000.;
		if (abs(D) < 0.01 && collinear < 0.5) {
			if (jointType >= ROUND && jointType < ROUND + 1.5) {
				jointType = JOINT_CAP_ROUND;
			}
		}

        if (vert.num < 3.5) { // Vertex #1 ~ 4
            if (abs(D) < 0.01) {
                pos = dy * norm;
            } else {
                if (flag < 0.5 && inner < 0.5) { // Vertex #1, 2
                    pos = dy * norm;
                } else { // Vertex #3, 4
                    pos = doBisect(norm, len, norm2, len2, dy, inner);
                }
            }


            if (capType >= CAP_BUTT && capType < CAP_ROUND) {
                var extra: f32 = step(CAP_SQUARE, capType) * strokeWidth;
                let back: vec2f = -forward;
                if (vertexNum < 0.5 || vertexNum > 2.5) {
                    pos = pos + (back * (expand + extra));
                    dy2 = expand;
                } else { 
                    dy2 = dot(pos + base - pointA, back) - extra;
                }
            }
            if (jointType >= JOINT_CAP_BUTT && jointType < JOINT_CAP_SQUARE + 0.5) {
                let extra: f32 = step(JOINT_CAP_SQUARE, jointType) * strokeWidth;
                if (vertexNum < 0.5 || vertexNum > 2.5) {
                    dy3 = dot(pos + base - pointB, forward) - extra;
                } else { 
                    pos = pos + (forward * (expand + extra));
                    dy3 = expand;
                    if (capType >= CAP_BUTT) {
                        dy2 = dy2 - (expand + extra);
                    }
                }
            }
        } else {
            // Vertex #5 ~ 9
            if (jointType >= JOINT_CAP_ROUND && jointType < JOINT_CAP_ROUND + 1.5) {
                if (inner > 0.5) {
                    dy = -dy;
                    inner = 0.;
                }
                var d2: vec2<f32> = abs(dy) * forward;
                if (vertexNum < 4.5) {
                    dy = -dy;
                    pos = dy * norm;
                } else { 			
                    if (vertexNum < 5.5) {
                        pos = dy * norm;
                    } else { 			
                        if (vertexNum < 6.5) {
                            pos = dy * norm + d2;
                            output.arc.x = abs(dy);
                        } else { 
                            dy = -dy;
                            pos = dy * norm + d2;
                            output.arc.x = abs(dy);
                        }
                    }
                }
                dy2 = 0.;
                output.arc.y = dy;
                output.arc.z = 0.;
                output.arc.w = strokeWidth;
                output.jointType = 3.;
            } else if (abs(D) < 0.01) {
                pos = dy * norm;
            } else {
                if (jointType >= ROUND && jointType < ROUND + 1.5) {
                    if (inner > 0.5) {
                        dy = -dy;
                        inner = 0.;
                    }
                    if (vertexNum < 4.5) {
                        pos = doBisect(norm, len, norm2, len2, -dy, 1.);
                    } else { 				
                        if (vertexNum < 5.5) {
                            pos = dy * norm;
                        } else { 				
                            if (vertexNum > 7.5) {
                                pos = dy * norm2;
                            } else { 
                                pos = doBisect(norm, len, norm2, len2, dy, 0.);
                                var d2: f32 = abs(dy);
                                if (length(pos) > abs(dy) * 1.5) {
                                    if (vertexNum < 6.5) {
                                        pos.x = dy * norm.x - d2 * norm.y;
                                        pos.y = dy * norm.y + d2 * norm.x;
                                    } else { 
                                        pos.x = dy * norm2.x + d2 * norm2.y;
                                        pos.y = dy * norm2.y - d2 * norm2.x;
                                    }
                                }
                            }
                        }
                    }
                    var norm3: vec2f = normalize(norm + norm2);
                    var sign: f32 = step(0., dy) * 2. - 1.;
                    output.arc.x = sign * dot(pos, norm3);
                    output.arc.y = pos.x * norm3.y - pos.y * norm3.x;
                    output.arc.z = dot(norm, norm3) * strokeWidth;
                    output.arc.w = strokeWidth;
                    dy = -sign * dot(pos, norm);
                    dy2 = -sign * dot(pos, norm2);
                    dy3 = output.arc.z - output.arc.x;
                    output.jointType = 3.;
                } else {
                    var hit: f32 = 0.;
                    if (jointType >= BEVEL && jointType < BEVEL + 1.5) {
                        if (dot(norm, norm2) > 0.) {
                            jointType = MITER;
                        }
                    }
                    if (jointType >= MITER && jointType < MITER + 3.5) {
                        if (inner > 0.5) {
                            dy = -dy;
                            inner = 0.;
                        }
                        var sign: f32 = step(0., dy) * 2. - 1.;
                        pos = doBisect(norm, len, norm2, len2, dy, 0.);
                        if (length(pos) > abs(dy) * strokeMiterlimit) {
                            jointType = BEVEL;
                        } else { 
                            if (vertexNum < 4.5) {
                                dy = -dy;
                                pos = doBisect(norm, len, norm2, len2, dy, 1.);
                            } else { 						
                                if (vertexNum < 5.5) {
                                    pos = dy * norm;
                                } else { 						
                                    if (vertexNum > 6.5) {
                                        pos = dy * norm2;
                                    }
                                }
                            }
                            output.jointType = 1.;
                            dy = -sign * dot(pos, norm);
                            dy2 = -sign * dot(pos, norm2);
                            hit = 1.;
                        }
                    }
                    if (jointType >= BEVEL && jointType < BEVEL + 1.5) {
                        if (inner > 0.5) {
                            dy = -dy;
                            inner = 0.;
                        }
                        let d2: f32 = abs(dy);
                        let pos3: vec2f = vec2f(dy * norm.x - d2 * norm.y, dy * norm.y + d2 * norm.x);
                        let pos4: vec2f = vec2f(dy * norm2.x + d2 * norm2.y, dy * norm2.y - d2 * norm2.x);
                        if (vertexNum < 4.5) {
                            pos = doBisect(norm, len, norm2, len2, -dy, 1.);
                        } else { 					
                            if (vertexNum < 5.5) {
                                pos = dy * norm;
                            } else { 					
                                if (vertexNum > 7.5) {
                                    pos = dy * norm2;
                                } else { 
                                    if (vertexNum < 6.5) {
                                        pos = pos3;
                                    } else { 
                                        pos = pos4;
                                    }
                                }
                            }
                        }
                        let norm3: vec2f = normalize(norm + norm2);
                        let sign: f32 = step(0., dy) * 2. - 1.;
                        dy = -sign * dot(pos, norm);
                        dy2 = -sign * dot(pos, norm2);
                        dy3 = -sign * dot(pos, norm3) + strokeWidth;
                        output.jointType = 4.;
                        hit = 1.;
                    }
                    if (hit < 0.5) {
                        output.position = vec4f(0., 0., 0., 1.);
                        return output;
                    }
                }
            }
            pos = pos + (base);
            output.distance = vec4f(dy, dy2, dy3, strokeWidth) * dpr;
            output.arc = output.arc * (dpr);
            output.travel = vert.travel + dot(pos - pointA, vec2f(-norm.y, norm.x));
        }
    }

    output.scalingFactor = 1.;
    output.position = vec4f((gloabalUniforms.u_ProjectionMatrix
        * gloabalUniforms.u_ViewMatrix
        * vec3f(pos, 1)).xy, 2/zindexTop, 1);
    output.fragPosition = pos;
    return output;
}


const epsilon: f32 = 0.000001;
@fragment
fn fs(fragData: VertexOutput) -> @location(0) vec4f {
    let strokeColor: vec4<f32> = vec4f(0,0,0,1.0);// u_StrokeColor;
	let opacity: f32 = 1.0; // u_Opacity.x;
	let strokeOpacity: f32 = 1.0; // u_Opacity.z;
	let strokeAlignment: f32 = 1.0; // u_ZIndexStrokeWidth.w;
	var alpha: f32 = 1.;
	let d1: f32 = fragData.distance.x;
	let d2: f32 = fragData.distance.y;
	let d3: f32 = fragData.distance.z;
	let w: f32 = fragData.distance.w;
    let jointType = fragData.jointType;
    var distance: f32;
    if (jointType < 0.5) {
		var left: f32 = max(d1 - 0.5, -w);
		var right: f32 = min(d1 + 0.5, w);
		let near: f32 = d2 - 0.5;
		let far: f32 = min(d2 + 0.5, 0.);
		let top: f32 = d3 - 0.5;
		let bottom: f32 = min(d3 + 0.5, 0.);
        distance = right - left;
		// alpha = max(antialias(right - left), 0.) * max(bottom - top, 0.) * max(far - near, 0.);
        alpha = max(bottom - top, 0.) * max(far - near, 0.);
	} else {
        if (jointType < 1.5) {
            var a1: f32 = pixelLine(d1 - w);
            var a2: f32 = pixelLine(d1 + w);
            var b1: f32 = pixelLine(d2 - w);
            var b2: f32 = pixelLine(d2 + w);
            var left: f32 = max(d1 - 0.5, -w);
            var right: f32 = min(d1 + 0.5, w);
            distance = a2 * b2 - a1 * b1;
            // alpha = clamp(distance / fwidth(distance), 0., 1.);
        } else { 	
            if (jointType < 2.5) {
                alpha = alpha * (max(min(d1 + 0.5, 1.), 0.));
                alpha = alpha * (max(min(d2 + 0.5, 1.), 0.));
                alpha = alpha * (max(min(d3 + 0.5, 1.), 0.));
                distance = 0; 
            } else { 	
                if (jointType < 3.5) {
                    var a1: f32 = pixelLine(d1 - w);
                    var a2: f32 = pixelLine(d1 + w);
                    var b1: f32 = pixelLine(d2 - w);
                    var b2: f32 = pixelLine(d2 + w);
                    let alpha_miter: f32 = a2 * b2 - a1 * b1;
                    let alpha_bevel: f32 = pixelLine(d3);
                    let r: f32 = length(fragData.arc.xy);
                    let circle_hor: f32 = pixelLine(w + r) - pixelLine(-w + r);
                    let circle_vert: f32 = min(w * 2., 1.);
                    let alpha_circle: f32 = circle_hor * circle_vert;
                    alpha = min(alpha_miter, max(alpha_circle, alpha_bevel));
                    distance = 0;
                } else { 
                    let a1: f32 = pixelLine(d1 - w);
                    let a2: f32 = pixelLine(d1 + w);
                    let b1: f32 = pixelLine(d2 - w);
                    let b2: f32 = pixelLine(d2 + w);
                    distance = a2 * b2 - a1 * b1;
                    alpha = pixelLine(d3);
                    // alpha = antialias(a2 * b2 - a1 * b1);
                    // alpha = alpha * (pixelLine(d3));
                }
            }
        }
    }
    alpha *= antialias(distance);
    // let u_Dash: f32 = u_StrokeDash.x;
	// let u_Gap: f32 = u_StrokeDash.y;
	// let u_DashOffset: f32 = u_StrokeDash.z;
	// if (u_Dash + u_Gap > 1.) {
	// 	let travel: f32 = ((v_Travel + u_Gap * v_ScalingFactor * 0.5 + u_DashOffset) % (u_Dash * v_ScalingFactor + u_Gap * v_ScalingFactor)) - u_Gap * v_ScalingFactor * 0.5;
	// 	let left: f32 = max(travel - 0.5, -0.5);
	// 	let right: f32 = min(travel + 0.5, u_Gap * v_ScalingFactor + 0.5);
	// 	alpha = alpha * (antialias(max(0., right - left)));
	// }
	var outputColor = strokeColor;
    return outputColor;
	// outputColor.a = outputColor.a * (alpha * opacity * strokeOpacity);
	// if (outputColor.a < epsilon) {
	// 	discard;
	// }
    // return outputColor;
}

fn antialias(distance: f32) -> f32 {
	return clamp(distance / fwidth(distance), 0., 1.);
} 

fn pixelLine(x: f32) -> f32 {
	return clamp(x + 0.5, 0., 1.);
} 