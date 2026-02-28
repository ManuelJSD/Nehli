const handleHttpError = (res, message = "Algo sucedio", code = 403) => { 
    try {
        //res.status(code);
        res.send({error: message});
    } catch (error) {
        res.status(403);
        res.send({ errors: error.array() });
    }
}

module.exports = {handleHttpError}