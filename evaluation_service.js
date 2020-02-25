const Docker = require('dockerode');
const tar = require("tar-fs");
const fs = require("fs");
const os = require("os");
const path = require("path");

const imageName = process.env.ALGAE_IMAGE_NAME;

class EvaluationService {
    static createConnection() {
        return new Docker({ socketPath: '/var/run/docker.sock' });
    }

    static pullImage(conn) {
        return new Promise(async (resolve, reject) => {
            if (await EvaluationService.imageExists(conn)) {
                resolve(conn.getImage(imageName));
                return;
            };

            conn.pull(imageName, (pullError, stream) => {
                if (pullError) {
                    reject(pullError);
                    return;
                }

                if (!stream) {
                    throw new Error(`Image doesn't exists`);
                }

                conn.modem.followProgress(stream, (error, output) => {
                    if (error) {
                        reject(error);
                        return;
                    }
    
                    resolve(conn.getImage(imageName));
                });
            });
        });
    }

    static async imageExists(conn) {
        const images = await conn.listImages({ filters: { reference: [imageName] } });
        return images.length > 0;
    }

    static createContainer(conn, env) {
        return conn.createContainer({
            Image: imageName,
            AttachStdin: false,
            AttachStdout: true,
            AttachStderr: true,
            Tty: true,
            Cmd: ['/bin/bash', '-c', 'tail -f /var/log/dmesg'],
            OpenStdin: false,
            StdinOnce: false,
            Env: env
        });
    }

    // Reference:
    // https://github.com/zojeda/docker-workspace/blob/f1672d50631f79d06a4c64f2a6f07f691352755d/src/FSCopyProvisioner.ts
    static async moveToContainer(container, sourcePath, destPath) {
        return new Promise((resolve, reject) => {
            const tmpDir = path.join(os.tmpdir(), "algae-tmp");
            if(!fs.existsSync(tmpDir)) {
                fs.mkdirSync(tmpDir);
            }
    
            const tarPath = path.join(tmpDir, "projects.tar");
            tar.pack(sourcePath).pipe(fs.createWriteStream(tarPath))
                .on("finish", async () => {
                    await container.putArchive(tarPath,{ path: destPath });
                    resolve();
                }); 
        });
    }

    static async extractFromContainer(container, sourcePath, destPath) {
        return new Promise(async (resolve, reject) => {
            const readableStream = await container.getArchive({
                path: sourcePath
            });
    
            const tmpDir = path.join(os.tmpdir(), "algae-tmp");
            if(!fs.existsSync(tmpDir)) {
                fs.mkdirSync(tmpDir);
            }
    
            const tarPath = path.join(tmpDir, "results.tar");
            const writableStream = fs.createWriteStream(tarPath);
            readableStream.pipe(writableStream);
            readableStream.on("end", () => {
                const readableTar = fs.createReadStream(tarPath);
                readableTar.pipe(tar.extract(destPath));
                readableTar.on("end", () => {
                    resolve();
                });
            });
        });
    }

    static async startContainerAndWait(container) {
        await container.start()
        await container.wait({
            condition: "not-running"
        });
    }
}

module.exports = EvaluationService;
