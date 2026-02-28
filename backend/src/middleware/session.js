const { handleHttpError } = require("../utils/handleError");
const { verifyToken } = require("../utils/handleJwt")
const { cuentasModel } = require("../models")

const authMiddleware = async (req, res, next) => {
  try {

    if(!req.headers.authorization){
        handleHttpError(res, "NEED_SESSION", 401);
        return
    }

    const token = req.headers.authorization.split(' ').pop();
    const dataToken = await verifyToken(token);

    if(!dataToken){
        handleHttpError(res, "NOT_PAYLOAD_DATA", 401);
        return
    }

     const cuenta = await cuentasModel.findOne({
      where: {id: dataToken.id}
     })

     req.user = cuenta
    

    next()
    

  } catch (e) {
    handleHttpError(res, "NOT_SESSION", 401);
  }
};

module.exports = authMiddleware;
