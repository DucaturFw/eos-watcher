import "reflect-metadata";
import container from "./inversify.config";
import types, { IApp } from "./types";

container.get<IApp>(types.App).run();
