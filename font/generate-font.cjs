const generateBMFont = require('msdf-bmfont-xml');
const fs = require('fs');
const path = require('path');
const content = fs.readFileSync(path.resolve(__dirname, './charset.txt'), "utf8");
console.log(content);
const opt = {
  charset: content,
  outputType: 'json',
  textureSize: [2048, 2048]
};

const fonts = [
  'PingFangSC-Light',
  'PingFangSC-Medium',
  'PingFangSC-Regular',
  'PingFangSC-Semibold',
  'PingFangSC-Thin',
  'PingFangSC-Ultralight',
]

function genFont(i) {
  const fname = fonts[i];
  if(!fname) return;
  generateBMFont(
    path.resolve(__dirname, `../assets/PingFangSC-main/ttf/${fname}.ttf`), 
    opt, 
    (error, textures, font) => {
      if (error) throw error;
      const dirname = path.resolve(__dirname, `../assets/PingFangSC/${fname}`);
      console.log(dirname);
      fs.mkdirSync(dirname)
      textures.forEach((texture, index) => {
        fs.writeFile(path.resolve(dirname, `${fname}.${index}.png`) , texture.texture, (err) => {
          if (err) throw err;
        });
      }),
      fs.writeFile(path.resolve(dirname, `${fname}.json`), font.data, (err) => {
        if (err) throw err;
      })

      genFont(i+1);
  });
}

genFont(0)
