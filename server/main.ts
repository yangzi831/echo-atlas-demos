import {createRelay} from './relay';
const port=Number(process.env.PORT||3198);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid port');
const server=createRelay(process.env.ALLOWED_ORIGINS?{ALLOWED_ORIGINS:process.env.ALLOWED_ORIGINS}:{});
server.listen(port,'127.0.0.1',()=>console.info(`Echo Atlas relay listening on loopback port ${port}`));
function stop(){server.close();server.closeAllConnections();setTimeout(()=>process.exit(0),3000).unref();}
process.once('SIGTERM',stop);process.once('SIGINT',stop);
