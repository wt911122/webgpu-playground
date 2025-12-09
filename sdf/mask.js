const maskcode = `
struct VSIn {
  @location(0) pos: vec4f,
};
struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) fragPosition: vec2f
};
@vertex fn vs(vsIn: VSIn) -> VSOut {
  var vsOut: VSOut;
  vsOut.pos = vec4f(vsIn.pos.xy, 0, 1);
  vsOut.fragPosition = vsOut.pos.xy;
  return vsOut;
}

@fragment fn fs(vin: VSOut) -> @location(0) vec4f {
  var v_FragCoord = vin.fragPosition;
  var d_outer = sdRectangle(v_FragCoord, vec2f(0.5, 0.5), vec4f(0.1, 0.1, 0.1, 0.1));

  if (d_outer > 0.0) {
      discard;
  }
  return vec4f(1, 0, 0, 1);
}

fn sdRectangle(p: vec2f, b: vec2f, r: vec4f) -> f32 {
    var m = select(r.zw, r.xy, p.x > 0.0);  //(p.x > 0.0) ? r.xy : r.zw;
    var n = select(m.y, m.x, p.y > 0.0); // (p.y > 0.0) ? t.x  : t.y;
    var q = abs(p) - b + n;
    return min(max(q.x, q.y), 0.0) + length(max(q, vec2f(0.0, 0.0))) - n;
}
`;
const renderCode = `
struct ShapeUniforms {
    color: vec4f,
    zIndex: f32,
}
@group(0) @binding(0) var<uniform> obj: ShapeUniforms;

struct VSIn {
  @location(0) pos: vec4f,
};
struct VSOut {
  @builtin(position) pos: vec4f,
};
@vertex fn vs(vsIn: VSIn) -> VSOut {
  var vsOut: VSOut;
  vsOut.pos = vec4f(vsIn.pos.xy, 1-obj.zIndex/10, 1);
  return vsOut;
}
@fragment fn fs(vin: VSOut) -> @location(0) vec4f {
  return obj.color;
}
`;

const renderPassDescription = (colorTexture, stencilTexture) => ({
    "colorAttachments": [
      {
          "view": colorTexture.createView(),
          "clearValue": [0,0,0,0],
          "storeOp": "store",
          "loadOp": "clear"
      }
    ],
    "depthStencilAttachment": {
        "view": stencilTexture.createView(),
        "stencilStoreOp": "store",
        "stencilLoadOp": "clear",
        "depthClearValue": 1,
        "depthLoadOp": "clear",
        "depthStoreOp": "store"
    }
});

const maskPipelineDescription = (program) => ({
  label: 'make pipeline',
  layout: 'auto',
  vertex: {
    module: program,
    entryPoint: 'vs',
    buffers: [
      // position
      {
        arrayStride: 2 * 4, // 2 floats, 4 bytes each
        attributes: [
          {shaderLocation: 0, offset: 0, format: 'float32x2'},
        ],
        stepMode: "vertex"
      },
    ],
  },
  fragment: {
      module: program,
      entryPoint: 'fs',
      targets: [{
          "format": "bgra8unorm",
          "writeMask": 0,
          "blend": {
              "alpha": {
                  "srcFactor": "one",
                  "dstFactor": "one-minus-src-alpha",
                  "operation": "add"
              },
              "color": {
                  "srcFactor": "one",
                  "dstFactor": "one-minus-src-alpha",
                  "operation": "add"
              }
          }
      }],
    },
    "depthStencil": {
        "stencilFront": {
            "compare": "equal",
            "passOp": "increment-clamp"
        },
        "stencilBack": {
            "compare": "equal",
            "passOp": "increment-clamp"
        },
        "format": "depth24plus-stencil8",
        "depthWriteEnabled": false,
        "depthCompare": "always"
    }
});

const maskEndPipelineDescription = (program) => ({
  label: 'make end pipeline',
  layout: 'auto',
  vertex: {
    module: program,
    entryPoint: 'vs',
    buffers: [
      // position
      {
        arrayStride: 2 * 4, // 2 floats, 4 bytes each
        attributes: [
          {shaderLocation: 0, offset: 0, format: 'float32x2'},
        ],
        stepMode: "vertex"
      },
    ],
  },
  fragment: {
      module: program,
      entryPoint: 'fs',
      targets: [{
          "format": "bgra8unorm",
          "writeMask": 0,
          "blend": {
              "alpha": {
                  "srcFactor": "one",
                  "dstFactor": "one-minus-src-alpha",
                  "operation": "add"
              },
              "color": {
                  "srcFactor": "one",
                  "dstFactor": "one-minus-src-alpha",
                  "operation": "add"
              }
          }
      }],
    },
    "depthStencil": {
        "stencilFront": {
            "compare": "equal",
            "passOp": "decrement-clamp"
        },
        "stencilBack": {
            "compare": "equal",
            "passOp": "decrement-clamp"
        },
        "format": "depth24plus-stencil8",
        "depthWriteEnabled": false,
        "depthCompare": "always"
    }
});


const generalPipelineDescription = (program, layout) => ({
 label: 'general pipeline',
  layout,
  vertex: {
    module: program,
    entryPoint: 'vs',
    buffers: [
      // position
      {
        arrayStride: 2 * 4, // 2 floats, 4 bytes each
        attributes: [
          {shaderLocation: 0, offset: 0, format: 'float32x2'},
        ],
      },
    ],
  },
  fragment: {
    module: program,
    entryPoint: 'fs',
    targets: [{
      format: 'bgra8unorm',
      writeMask: GPUColorWrite.ALL,
      blend: {
          color: {
              operation: 'add',
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha'
          },
          alpha: {
              operation: 'add',
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha'
          }
      }
    }],
  },
  depthStencil: {
      "stencilWriteMask": 0,
      "stencilFront": {
          "compare": "equal",
          "passOp": "keep"
      },
      "stencilBack": {
          "compare": "equal",
          "passOp": "keep"
      },
      "format": "depth24plus-stencil8",
      "depthWriteEnabled": true,
      "depthCompare": "less"
  }
});

(async() => {
  console.log('mask start')
  const adapter = await navigator.gpu?.requestAdapter();
  const device = await adapter?.requestDevice();
  if (!device) {
    alert('need webgpu');
    return;
  }

  const canvas = document.querySelector("canvas")
  const context = canvas.getContext('webgpu');
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
      device,
      format: presentationFormat,
      alphaMode: 'premultiplied',
  });

  const maskProgram = device.createShaderModule({code: maskcode});
  const maskMakingPipeline = device.createRenderPipeline(maskPipelineDescription(maskProgram));

  const roundUp = (v, alignment) => Math.ceil(v / alignment) * alignment;
  const MAX_OBJECTS = 10;
  const uniformBufferSize = 32;
  const shapeProgram = device.createShaderModule({code: renderCode});
  const bindGroupLayout = device.createBindGroupLayout({
      entries: [
          { 
              binding: 0, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
              buffer: { type: 'uniform', minBindingSize: uniformBufferSize },
          },
      ]
  });
  const pipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [ bindGroupLayout ],
  });

  const generalPipeline = device.createRenderPipeline(generalPipelineDescription(shapeProgram, pipelineLayout));
  
  const maskEndPipeline = device.createRenderPipeline(maskEndPipelineDescription(maskProgram));


  const uniformBufferSpace = roundUp(uniformBufferSize, device.limits.minUniformBufferOffsetAlignment);
  const dynamicUniformBuffer = device.createBuffer({
      label: 'uniforms',
      size: uniformBufferSpace * MAX_OBJECTS,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const _bindGroups = [];
  for (let i = 0; i < MAX_OBJECTS; ++i) {
      const uniformBufferOffset = i * uniformBufferSpace;
      const bindGroup =  device.createBindGroup({
          label: 'bindingGroup',
          layout: bindGroupLayout,
          entries: [
              { binding: 0, resource: { buffer: dynamicUniformBuffer,  offset: uniformBufferOffset, size: uniformBufferSize } },
          ],
      });
      // console.log(uniformBufferOffset, uniformBufferSize)
      _bindGroups.push(bindGroup)
  }

  const dynamicUniformTransferBuffer = device.createBuffer({
      label: 'dynamic uniform transfer buffer',
      size: uniformBufferSpace * MAX_OBJECTS,
      usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC,
      mappedAtCreation: true,
  });
  const encoder = device.createCommandEncoder();
  const stencilTexture = device.createTexture({
    label: 'depthTexture',
    format: 'depth24plus-stencil8',
    size: [canvas.width, canvas.height],
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });
  
  const numObjects = 4;
  const triangles = [
    new Float32Array([0, -1, 1, -1, -1, 1]),
    new Float32Array([-1, -1, 1, -1, 1, 0]),
    new Float32Array([-1, 1, 1, 1, 1, 0]),
    new Float32Array([0, 0.5, 0.5, -0.5, 0, -0.5]),
  ]
  const triangleBuffers = [];
  for (let i = 0; i < numObjects; ++i) {
    const vertics = triangles[i];
    const buff = device.createBuffer({
      size: vertics.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(buff, 0, vertics);
    triangleBuffers.push(buff);
  }

  const colors = [
    [1,0,0,1],
    [0,1,0,1],
    [0,0,1,1],
    [0,1,1,1]
  ]
  const uniformValues = new Float32Array(dynamicUniformTransferBuffer.getMappedRange());
  const size = (numObjects - 1) * uniformBufferSpace + uniformBufferSize;
  encoder.copyBufferToBuffer(dynamicUniformTransferBuffer, 0, dynamicUniformBuffer, 0, size);
  for (let i = 0; i < numObjects; ++i) {
    const c = colors[i];
    const uniformBufferOffset = i * uniformBufferSpace;
    const f32Offset = uniformBufferOffset / 4;
    const materialValue = uniformValues.subarray(f32Offset, f32Offset + 16);
    materialValue[0] = c[0];
    materialValue[1] = c[1];
    materialValue[2] = c[2];
    materialValue[3] = c[3];
    materialValue[4] = i+1;
    console.log(materialValue, 1-(i+1)/10, (i+1))
  }
  dynamicUniformTransferBuffer.unmap();

  // const pass = encoder.beginRenderPass({
  //   colorAttachments: [{
  //     view: context.getCurrentTexture().createView(),
  //     clearValue: [0, 0, 0, 0],
  //     loadOp: 'clear',
  //     storeOp: 'store',
  //   }],
  //   depthStencilAttachment: undefined
  // });

  const pass = encoder.beginRenderPass(renderPassDescription( 
    context.getCurrentTexture(), 
    stencilTexture));
  
  {
    // red triangle
   
    // draw only the mask is
    pass.setPipeline(generalPipeline);
    pass.setStencilReference(0);
    pass.setBindGroup(0, _bindGroups[0]);
    pass.setVertexBuffer(0, triangleBuffers[0]);
    pass.draw(3);
  }

  //  const stencilTexture2 = device.createTexture({
  //   label: 'depthTexture',
  //   format: 'depth24plus-stencil8',
  //   size: [canvas.width, canvas.height],
  //   usage: GPUTextureUsage.RENDER_ATTACHMENT,
  // });
  {

    const maskVertsArray = [
      new Float32Array([-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5 ]),
      new Float32Array([-0.3, -0.3, 0.3, -0.3, 0.3, 0.3, -0.3, 0.3 ]),
    ]
    
    const maskBuffers = [];

    for(let i=0;i<2;i++) {
      const vert = maskVertsArray[i];
      const maskVertexBuffer = device.createBuffer({
        size: vert.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
      device.queue.writeBuffer(maskVertexBuffer, 0, vert);
      maskBuffers.push(maskVertexBuffer);
    }
    // 遮罩
    // const maskVerts = new Float32Array([-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5 ]);
    const maskIndicesArray = new Uint16Array([
          0, 1, 2, 0, 2, 3
      ]);
    // const maskVertexBuffer = device.createBuffer({
    //   size: maskVerts.byteLength,
    //   usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    // });
    // device.queue.writeBuffer(maskVertexBuffer, 0, maskVerts);
    const maskIndicesBuffer = device.createBuffer({
      size: maskIndicesArray.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(maskIndicesBuffer, 0, maskIndicesArray);

    // draw the mask
    pass.setPipeline(maskMakingPipeline);
    pass.setVertexBuffer(0, maskBuffers[0]);
    pass.setIndexBuffer(maskIndicesBuffer, 'uint16');
    pass.setStencilReference(0);
    pass.drawIndexed(6, 1);
      // pass.end();


    pass.setStencilReference(1);
    pass.setPipeline(generalPipeline);

    pass.setPipeline(maskMakingPipeline);
    pass.setVertexBuffer(0, maskBuffers[1]);
    pass.setIndexBuffer(maskIndicesBuffer, 'uint16');
    pass.drawIndexed(6, 1);
    pass.setStencilReference(2);

    pass.setPipeline(generalPipeline);
    pass.setBindGroup(0, _bindGroups[3]);
    pass.setVertexBuffer(0, triangleBuffers[3]);
    pass.draw(3);

    pass.setPipeline(maskEndPipeline);
    pass.setVertexBuffer(0, maskBuffers[1]);
    pass.setIndexBuffer(maskIndicesBuffer, 'uint16');
    pass.drawIndexed(6, 1);
    pass.setStencilReference(1);

    // pass.setPipeline(generalPipeline);
    // pass.setBindGroup(0, _bindGroups[1]);
    // pass.setVertexBuffer(0, triangleBuffers[1]);
    // pass.draw(3);

    pass.setPipeline(maskEndPipeline);
    pass.setVertexBuffer(0, maskBuffers[0]);
    pass.setIndexBuffer(maskIndicesBuffer, 'uint16');
    pass.drawIndexed(6, 1);

    pass.setStencilReference(0);

    // ===== 第一层遮罩开始 =====
  // 绘制第一层遮罩 (stencil 0 -> 1)
//   pass.setPipeline(maskMakingPipeline);
//   pass.setStencilReference(0);  // 在这里设置
//   pass.setVertexBuffer(0, maskBuffers[0]);
//   pass.setIndexBuffer(maskIndicesBuffer, 'uint16');
//   pass.drawIndexed(6, 1);

//   // ===== 第二层遮罩开始 =====
//   // 绘制第二层遮罩 (stencil 1 -> 2)
//   pass.setPipeline(maskMakingPipeline);
//   pass.setStencilReference(1);  // 在这里设置
//   pass.setVertexBuffer(0, maskBuffers[1]);
//   pass.setIndexBuffer(maskIndicesBuffer, 'uint16');
//   pass.drawIndexed(6, 1);

//   // 绘制第二层遮罩内的内容 (stencil == 2)
//   pass.setPipeline(generalPipeline);
//   pass.setStencilReference(2);
//   pass.setBindGroup(0, _bindGroups[3]);
//   pass.setVertexBuffer(0, triangleBuffers[3]);
//   pass.draw(3);

//   // 结束第二层遮罩 (stencil 2 -> 1)
//   pass.setPipeline(maskEndPipeline);
//   pass.setStencilReference(2);  // 在这里设置
//   pass.setVertexBuffer(0, maskBuffers[1]);
//   pass.setIndexBuffer(maskIndicesBuffer, 'uint16');
//   pass.drawIndexed(6, 1);
//   // ===== 第二层遮罩结束 =====

//   // 绘制第一层遮罩内的内容 (stencil == 1)
//   pass.setPipeline(generalPipeline);
//   pass.setStencilReference(1);
//   pass.setBindGroup(0, _bindGroups[1]);
//   pass.setVertexBuffer(0, triangleBuffers[1]);
//   pass.draw(3);

//   // 结束第一层遮罩 (stencil 1 -> 0)
//   pass.setPipeline(maskEndPipeline);
//   pass.setStencilReference(1);  // 在这里设置
//   pass.setVertexBuffer(0, maskBuffers[0]);
//   pass.setIndexBuffer(maskIndicesBuffer, 'uint16');
//   pass.drawIndexed(6, 1);
//   // ===== 第一层遮罩结束 =====
// pass.setStencilReference(0);  // 在这里设置

    pass.setPipeline(generalPipeline);
    pass.setBindGroup(0, _bindGroups[2]);
    pass.setVertexBuffer(0, triangleBuffers[2]);
    pass.draw(3);
  }

  pass.end();

  device.queue.submit([encoder.finish()]);

  dynamicUniformTransferBuffer.mapAsync(GPUMapMode.WRITE)

  


})();