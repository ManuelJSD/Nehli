const { handleHttpError } = require("../utils/handleError");
/**
 * Array con los roles permitidos
 * @param {*} rol
 * @returns
 */
const checkRol = (roles) => (req, res, next) => {
  try {
    //Obtenemos el rol del usuario
    const { user } = req;
    const rolesByUser = user.role;

    //Obtenemos el rol que queremos validar
    const checkValueRol = roles.some((rolSingle) =>
    rolesByUser.includes(rolSingle)
    );

    //Validamos el rol
    if (!checkValueRol) {
      handleHttpError(res, "No tienes permisos", 403);
      return;
    }
    next();
  } catch (e) {
    console.log(e)
    handleHttpError(res, "ERROR_PERMISSIONS", 403);
  }
};

module.exports = checkRol;