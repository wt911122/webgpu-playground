import { parseSVG, makeAbsolute } from 'svg-path-parser';
import { CatmullRom, QuadraticBezier, CubicBezier } from './curve-functions';
function _parsePath(d) {
    const commands = parseSVG(d);
    makeAbsolute(commands);
    return commands;
}

export function parse(d) {
    const subpath = [];
    let currentPoint;

    const control = []

    const commands = _parsePath(d);
    commands.forEach((command) => {
        const code = command.code;
        switch (code) {
            case 'M':
                parseM(command, subpath, control);
                break;
            case 'L':
            case 'V':
            case 'H':
                parseL(command, subpath, control);
                break;
            case 'C':
                parseC(command, subpath, control);
                break;
            case 'S':
                parseS(command, subpath, control);
                break;
            case 'Q':
                parseQ(command, subpath, control);
                break;
            case 'T':
                parseT(command, subpath, control);
                break;
            case 'A':
                parseA(command, subpath, control);
                break;
            case 'Z':
                parseZ(command, subpath, control);
                subpath.closePath = true;
                break;
        }
    })
    // console.log(d, subpath);
    return subpath;
}
const DIVISIONS = 12;
const ARC_DIVISIONS = 24;
function getReflection(a, b) {
  return a - (b - a);
}
function parseM(command, subpath, control) {
    const { x, y } = command;
    subpath.push([x, y])
    control[0] = x;
    control[1] = y;
}
function parseZ(command, subpath, control) {
    // const firstpath = subpath[0];
    const currpath = subpath[subpath.length-1];
    currpath.push(currpath[0], currpath[1]);
}

function parseL(command, subpath, control) {
    const currpath = subpath[subpath.length-1];
    const { x, y } = command;
    currpath.push(x, y);
    control[0] = x;
    control[1] = y;
}
function parseC(command, subpath, control) {
    const currpath = subpath[subpath.length-1];
    const { x0, y0, x1, y1, x2, y2, x, y } = command;
    for (let d = 0; d <= DIVISIONS; d++) {
        const t = d / DIVISIONS;
        currpath.push(
            CubicBezier(t, x0, x1, x2, x), 
            CubicBezier(t, y0, y1, y2, y));
    }
    currpath.push(x, y);
    control[0] = x2;
    control[1] = y2;
}
function parseS(command, subpath, control) {
    const currpath = subpath[subpath.length-1];
    const { x0, y0, x2, y2, x, y } = command;
    const [x1, y1] = control;
   
    for (let d = 0; d <= DIVISIONS; d++) {
        const t = d / DIVISIONS;
        currpath.push(
            CubicBezier(t, x0, getReflection(x0, x1), x2, x), 
            CubicBezier(t, y0, getReflection(y0, y1), y2, y));
    }
    currpath.push(x, y);
    control[0] = x2;
    control[1] = y2;
}

function parseQ(command, subpath, control) {
    const currpath = subpath[subpath.length-1];
    const { x0, y0, x1, y1, x, y } = command;
    for (let d = 0; d <= DIVISIONS; d++) {
        const t = d / DIVISIONS;
        currpath.push(
            QuadraticBezier(t, x0, x1, x), 
            QuadraticBezier(t, y0, y1, y));
    }
    currpath.push(x, y);
    control[0] = x1;
    control[1] = y1;
}
function parseT(command, subpath, control) {
    const currpath = subpath[subpath.length-1];
    const { x0, y0, x, y } = command;
    const [x1, y1] = control;
    for (let d = 0; d <= DIVISIONS; d++) {
        const t = d / DIVISIONS;
        currpath.push(
            QuadraticBezier(t, x0, getReflection(x0, x1), x), 
            QuadraticBezier(t, y0, getReflection(y0, y1), y));
    }
    currpath.push(x, y);
}
const twoPi = Math.PI * 2;
function parseA(command, subpath, control) {
    const currpath = subpath[subpath.length-1];
    let rx = command.rx;
    let ry = command.ry;
    if ( rx == 0 || ry == 0 ) {
        parseL(command, subpath, control)
        return;
    }
    const { x0, y0, largeArc, sweep, x, y } = command; 

    let xAxisRotation = command.xAxisRotation;
    xAxisRotation = xAxisRotation * Math.PI / 180;

    // Ensure radii are positive
    rx = Math.abs( rx );
    ry = Math.abs( ry );

    // Compute (x1', y1')
    const dx2 = ( x0 - x ) / 2.0;
    const dy2 = ( y0 - y ) / 2.0;
    const x1p = Math.cos( xAxisRotation ) * dx2 + Math.sin( xAxisRotation ) * dy2;
    const y1p = - Math.sin( xAxisRotation ) * dx2 + Math.cos( xAxisRotation ) * dy2;

    // Compute (cx', cy')
    let rxs = rx * rx;
    let rys = ry * ry;
    const x1ps = x1p * x1p;
    const y1ps = y1p * y1p;

    // Ensure radii are large enough
    const cr = x1ps / rxs + y1ps / rys;

    if ( cr > 1 ) {

        // scale up rx,ry equally so cr == 1
        const s = Math.sqrt( cr );
        rx = s * rx;
        ry = s * ry;
        rxs = rx * rx;
        rys = ry * ry;

    }

    const dq = ( rxs * y1ps + rys * x1ps );
    const pq = ( rxs * rys - dq ) / dq;
    let q = Math.sqrt( Math.max( 0, pq ) );
    if ( largeArc === sweep ) q = - q;
    const cxp = q * rx * y1p / ry;
    const cyp = - q * ry * x1p / rx;

    // Step 3: Compute (cx, cy) from (cx', cy')
    const cx = Math.cos( xAxisRotation ) * cxp - Math.sin( xAxisRotation ) * cyp + ( x0 + x ) / 2;
    const cy = Math.sin( xAxisRotation ) * cxp + Math.cos( xAxisRotation ) * cyp + ( y0 + y ) / 2;

    // Step 4: Compute θ1 and Δθ
    const theta = svgAngle( 1, 0, ( x1p - cxp ) / rx, ( y1p - cyp ) / ry );
    let delta = svgAngle( ( x1p - cxp ) / rx, ( y1p - cyp ) / ry, ( - x1p - cxp ) / rx, ( - y1p - cyp ) / ry ) % ( Math.PI * 2 );

    const aStartAngle = theta;
    const aEndAngle = theta + delta; 
    const aRotation = xAxisRotation;
    
    const samePoints = Math.abs( delta ) < Number.EPSILON;

    // ensures that delta is 0 .. 2 PI
    while ( delta < 0 ) delta += twoPi;
    while ( delta > twoPi ) delta -= twoPi;

    if ( delta < Number.EPSILON ) {
        if ( samePoints ) {
            delta = 0;
        } else {
            delta = twoPi;
        }
    }

    if ( !sweep && ! samePoints ) {
        if ( delta === twoPi ) {
            delta = - twoPi;
        } else {
            delta = delta - twoPi;
        }
    }

    for (let d = 1; d <= DIVISIONS; d++) {
        const t = d / DIVISIONS;
        const angle = theta + t * delta;
        let px = cx + rx * Math.cos( angle );
        let py = cy + ry * Math.sin( angle );

        if ( aRotation !== 0 ) {
            const cos = Math.cos( aRotation );
            const sin = Math.sin( aRotation );

            const tx = px - cx;
            const ty = py - cy;

            // Rotate the point about the center of the ellipse.
            px = tx * cos - ty * sin + cy;
            py = tx * sin + ty * cos + cy;
        }
        currpath.push(px, py);
    }
    currpath.push(x, y);

    control[0] = x;
    control[1] = y;
}

function svgAngle( ux, uy, vx, vy ) {
    const dot = ux * vx + uy * vy;
    const len = Math.sqrt( ux * ux + uy * uy ) * Math.sqrt( vx * vx + vy * vy );
    let ang = Math.acos( Math.max( - 1, Math.min( 1, dot / len ) ) ); // floating point precision, slightly over values appear
    if ( ( ux * vy - uy * vx ) < 0 ) ang = - ang;
    return ang;

}






