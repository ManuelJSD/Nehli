const swaggerJsdoc = require("swagger-jsdoc");

/**
 * API Config Info
 */

const port = process.env.PORT || 3000;

const swaggerDefinition = {
    openapi: "3.0.0",
    info: {
        title: "Documentacion de API Nehli",
        version: "1.0.1",
    },
    servers: [
        {
            url: `http://localhost:${port}/api`,
        },
        // {
        //     url: "https://afternoon-journey-32165.herokuapp.com/api",
        // },
    ],
    components: {
        securitySchemes:{
            bearerAuth:{
                type:"http",
                scheme:"bearer"
            }
        },
        schemas: {
            noticias: {
                type: "object",
                required: ["titulo", "cuerpo"],
                properties: {
                    titulo: {
                        type: "string",
                    },
                    cuerpo: {
                        type: "string",
                    }
                }
            },

            authRegister: {
                type: "object",
                required: ["username", "email", "password"],
                properties: {
                    username: {
                        type: "string",
                    },
                    email: {
                        type: "string",
                    },
                    password: {
                        type: "string",
                    },
                },

            },
        },

    },
};


/**
 * Opciones
 */
 const options = {
        swaggerDefinition,
        apis: ["./routes/*.js"],
    };

    const openApiConfigration = swaggerJsdoc(options);

    module.exports = openApiConfigration;