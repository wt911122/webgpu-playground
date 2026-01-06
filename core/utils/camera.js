import { mat3, vec2 } from 'gl-matrix';
 
export function Camera() {
    let _zoom = 1;
    let _x = 0;
    let _y = 0;
    let _w = 0;
    let _h = 0;
    let _resolution = 0;
    let _aspect_ratio = 1;

    const matrix = mat3.create();
    const projectionMatrix = mat3.create();
    const viewMatrix = mat3.create();
    const viewProjectionMatrix = mat3.create();
    const viewProjectionMatrixInv = mat3.create();

    function projection(width, height) {
        _w = width;
        _h = height;
        _resolution = width/height;
        _aspect_ratio = 1/_resolution;
        mat3.projection(projectionMatrix, width, height);
    }

    function update() {
        const zoomScale = 1 / _zoom;
        mat3.identity(matrix);
        mat3.translate(matrix, matrix, [_x, _y]);
        mat3.scale(matrix, matrix, [zoomScale, zoomScale]);
        mat3.invert(viewMatrix, matrix);
        updateViewProjectionMatrix();
    }

    function updateViewProjectionMatrix() {
        mat3.multiply(viewProjectionMatrix, projectionMatrix, viewMatrix)
        mat3.invert(viewProjectionMatrixInv, viewProjectionMatrix);
    }

    function translate(x, y) {
        _x = x;
        _y = y;
        update();
    }

    function pan(deltaX, deltaY, noZoom) {
        if(noZoom) {
            _x += deltaX;
            _y += deltaY;
        } else {
            _x += deltaX/_zoom;
            _y += deltaY/_zoom;
        }
        update();
    }

    function zoom(s) {
        _zoom = s;
        update();
    }

    function setMatrix(x, y, zoom) {
        _x = x;
        _y = y;
        _zoom = zoom;
    } 
    
    function read() {
        console.log(matrix, projectionMatrix, viewMatrix, viewProjectionMatrix, viewProjectionMatrixInv)
    }

    function getProjectMatrix() {
        return projectionMatrix;
    }
    function getViewMatrix() {
        return viewMatrix;
    }
    function getViewProjectMatrixInv() {
        return viewProjectionMatrixInv
    }

    function getZoom() {
        return _zoom;
    }

    function getAspectRatio() {
        return _aspect_ratio;
    }
    
    return {
        projection,
        pan, 
        zoom,
        translate,
        getZoom,
        getAspectRatio,
        read,
        getProjectMatrix,
        getViewMatrix,
        update,
        setMatrix,
        getViewProjectMatrixInv,
    }
}

function paddingMat3(matrix) {
    return [
        matrix[0],
        matrix[1],
        matrix[2],
        0,
        matrix[3],
        matrix[4],
        matrix[5],
        0,
        matrix[6],
        matrix[7],
        matrix[8],
        0,
    ];
}
