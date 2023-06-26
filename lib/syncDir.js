const fs = require("fs");

/**
 * execute copy file logic
 * @param {*} src 
 * @param {*} dst 
 */
async function handleDir (src, dst) {
    return new Promise(async (resolve, reject) => {
        fs.access(dst, fs.constants.F_OK, async (err) => {
            if (err) {
                fs.mkdir(dst, { recursive: true }, async (err) => {
                    if (err) {
                        console.error(`error happened when handleDir.mkdir: ${err.message}`);
                        reject(`error happened when handleDir.mkdir: ${err.message}`);
                        return;
                    } else {
                        await copyDir(src, dst);
                    }
                  });
                
            } else {
                await copyDir(src, dst);
            }
            resolve(true);
        });
    }).catch(error => {
        console.error(`运行异常: ${error.message}`);
    });
}
 
/**
 * execute iterator copy directory
 * @param src directory source path
 * @param dst directory destination path
 * @returns copy result
 */
async function copyDir (src, dst) {
    return new Promise(async (resolve, reject) => {
        fs.readdir(src, (err, paths) => {
            paths.forEach(function(path){
              var _src=src+'/'+path;
              var _dst=dst+'/'+path;
              fs.stat(_src, async function(err,stats){
                if(err) {
                    console.error(`copyDir failed, caused by ${JSON.stringify(err)}`);
                    reject(false);
                } else if(stats.isFile()){
                  let readable=fs.createReadStream(_src);
                  let writable=fs.createWriteStream(_dst);
                  readable.pipe(writable);
                  readable.on('end', () => {
                    resolve(true);
                  });
                }else if(stats.isDirectory()) {
                  await handleDir(_src, _dst);
                }
              });
            });
        });
    }).catch(error => {
        console.error(`运行异常: ${error.message}`);
    });
}

module.exports ={
  copyDir
};