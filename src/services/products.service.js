import path from "path";
import fs from "fs";

import { daoProducts } from "../dao/daoInstance.js";
import { errorStatusMap } from "../utils/errorCodes.js";
import { emailService } from "./email/email.service.js";

class ProductsService {
  async readMany({ limit = 100, page = 1, sort, query }) {
    try {
      const parsedLimit = parseInt(limit);
      const parsedPage = parseInt(page);

      if (
        isNaN(parsedLimit) ||
        isNaN(parsedPage) ||
        parsedLimit <= 0 ||
        parsedPage <= 0
      ) {
        const error = new Error(
          "Los parámetros 'limit' y 'page' deben ser números mayores a 0"
        );
        error.code = errorStatusMap.INCORRECT_DATA;
        throw error;
      }

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        lean: true,
        sort:
          sort === "desc"
            ? { price: -1 }
            : sort === "asc"
            ? { price: 1 }
            : null,
      };

      const filter = query ? { category: query } : {};

      const result = await daoProducts.readMany(filter, options);

      const totalProducts = await daoProducts.count(filter);
      const totalPages = Math.ceil(totalProducts / limit);
      // const nextPage = page < totalPages ? page + 1 : null;
      const nextPage = parseInt(page) < totalPages ? parseInt(page) + 1 : null;
      const prevPage = page > 1 ? page - 1 : null;

      return {
        products: result,
        currentPage: page,
        totalPages,
        nextPage,
        prevPage,
      };
    } catch (error) {
      throw new Error(`Error en ProductsService.readMany: ${error}`);
    }
  }

  async readOne(id) {
    try {
      if (!id) {
        const error = new Error("El ID es requerido");
        error.code = errorStatusMap.INCORRECT_DATA;
        throw error;
      }

      const product = await daoProducts.readOne(id);
      if (!product) {
        const error = new Error(
          `No se encontró ningún producto con el ID ${id}`
        );
        error.code = errorStatusMap.NOT_FOUND;
        throw error;
      }
      return product;
    } catch (error) {
      throw error;
    }
  }

  async createOne(product) {
    try {
      if (!product) {
        const error = new Error(
          "No se recibieron datos para crear el producto"
        );
        error.code = errorStatusMap.INCORRECT_DATA;
        throw error;
      }

      const createdProduct = await daoProducts.createOne(product);
      if (!createdProduct) {
        const error = new Error("No se pudo crear el producto");
        error.code = errorStatusMap.UNEXPECTED_ERROR;
        throw error;
      }
      return createdProduct;
    } catch (error) {
      throw error;
    }
  }

  async updateOne(id, updates, owner) {
    try {
      if (!id) {
        const error = new Error("El ID es requerido");
        error.code = errorStatusMap.INCORRECT_DATA;
        throw error;
      }
      if (!updates || Object.keys(updates).length === 0) {
        const error = new Error("No se recibieron datos para actualizar");
        error.code = errorStatusMap.INCORRECT_DATA;
        throw error;
      }

      const product = await daoProducts.readOne(id);
      if (!product) {
        const error = new Error(
          `No se encontró ningún producto con el ID ${id}`
        );
        error.code = errorStatusMap.NOT_FOUND;
        throw error;
      }

      // if (owner.rol === "admin") {
      //   const updatedProduct = await daoProducts.updateOne(id, updates);
      //   return updatedProduct;
      // }

      // if (owner && owner.email && owner.email !== product.owner) {
      //   const error = new Error(
      //     "No tienes permisos para actualizar este producto"
      //   );
      //   error.code = errorStatusMap.FORBIDDEN;
      //   throw error;
      // }

      const updatedProduct = await daoProducts.updateOne(id, updates);
      return updatedProduct;
    } catch (error) {
      throw new Error(`Error en ProductsService.updateOne: ${error}`);
    }
  }

  async deleteOne(id, requestingUser) {
    try {
      if (!id) {
        const error = new Error("El ID es requerido");
        error.code = errorStatusMap.INCORRECT_DATA;
        throw error;
      }
      const product = await daoProducts.readOne(id);
      if (!product) {
        const error = new Error(
          `No se encontró ningún producto con el ID ${id}`
        );
        error.code = errorStatusMap.NOT_FOUND;
        throw error;
      }

      const isAdmin = requestingUser.rol === "admin";
      const isOwner =
        requestingUser &&
        requestingUser.email &&
        requestingUser.email === product.owner;

      if (!isAdmin && !isOwner) {
        const error = new Error(
          "No tienes permisos para eliminar este producto"
        );
        error.code = errorStatusMap.FORBIDDEN;
        throw error;
      }

      const deletedProduct = await daoProducts.deleteOne(id);

      const currentDir = path.resolve();
      const publicDir = path.resolve(currentDir, "public");

      for (const imgPath of product.thumbnail) {
        const finalPath = publicDir + imgPath;
        fs.unlinkSync(finalPath);
      }

      if (isAdmin || isOwner) {
        await emailService.send(
          product.owner,
          "Producto eliminado",
          `Tu producto "${product.title} - (${product.code})" ha sido eliminado`
        );
      }

      return deletedProduct;
    } catch (error) {
      throw error;
    }
  }
}

export const productsService = new ProductsService();
