import { BaseTexture } from './texture';


function getCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');

    return { canvas, context };
}

class Image2DTexture extends BaseTexture {
    constructor(imageBitmap) {
        super(imageBitmap.width, imageBitmap.height);
        this._source = imageBitmap;
    }
}
 
export function createImageTexture(imageBitmap) {
    return new Image2DTexture(imageBitmap);
}



