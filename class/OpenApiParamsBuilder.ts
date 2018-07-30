import {ParamMetadata, ParamRegistry, ParamTypes} from "@tsed/common";
import {deepExtends, nameOf, Type} from "@tsed/core";
import {BodyParameter, FormDataParameter, HeaderParameter, Parameter, PathParameter, QueryParameter, Schema} from "swagger-schema-official";
import {swaggerType} from "../utils";
import {OpenApiModelSchemaBuilder} from "./OpenApiModelSchemaBuilder";

export class OpenApiParamsBuilder extends OpenApiModelSchemaBuilder {
  private _parameters: Parameter[] = [];
  private injectedParams: ParamMetadata[];
  private hasBody: boolean = false;
  private hasFormData: boolean = false;
  private name: string = "";

  constructor(target: Type<any>, methodClassName: string, private pathParameters: PathParameter[] = []) {
    super(target);
    this.name = `${nameOf(target)}${methodClassName.charAt(0).toUpperCase() + methodClassName.slice(1)}`;

    this.injectedParams = ParamRegistry.getParams(target, methodClassName).filter(param => {
      if (param.paramType === ParamTypes.BODY) {
        this.hasBody = true;
      }

      if (param.paramType === ParamTypes.FORM_DATA) {
        this.hasFormData = true;
      }

      return !param.store.get("hidden");
    });
  }

  /**
   *
   * @returns {this}
   */
  build(): this {
    this._parameters = [];

    this._parameters = this._parameters.concat(this.getInHeaders(), this.getInPathParams(), this.getInQueryParams());

    if (this.hasFormData) {
      this._parameters = this._parameters.concat(this.getInFormData());
    } else if (this.hasBody) {
      this._parameters = this._parameters.concat(this.getInBodyParam());
    }

    return this;
  }

  /**
   *
   * @returns {HeaderParameter[]}
   */
  private getInHeaders(): HeaderParameter[] {
    return this.injectedParams.filter((param: ParamMetadata) => param.paramType === ParamTypes.HEADER).map(param => {
      return Object.assign({}, param.store.get("baseParameter"), {
        in: ParamTypes.HEADER,
        name: param.expression,
        type: swaggerType(param.type),
        required: param.required
      });
    });
  }

  /**
   *
   * @returns {any[]}
   */
  private getInFormData(): FormDataParameter[] {
    return this.injectedParams
      .filter((param: ParamMetadata) => param.paramType === ParamTypes.BODY || param.paramType === ParamTypes.FORM_DATA)
      .map(param => {
        const name = ((param.expression as string) || "").replace(".0", "");
        const type = param.paramType === ParamTypes.FORM_DATA ? "file" : swaggerType(param.paramType);

        return Object.assign({}, param.store.get("baseParameter"), {
          in: ParamTypes.FORM_DATA,
          name,
          required: param.required,
          type
        });
      });
  }

  /**
   *
   * @returns {ParamMetadata | undefined}
   */
  private getInBodyParam(): BodyParameter {
    const params = this.injectedParams.filter((param: ParamMetadata) => param.paramType === ParamTypes.BODY);

    const param = params.find((param: ParamMetadata) => !param.expression);

    if (param) {
      const builder = new OpenApiModelSchemaBuilder(param.type);
      builder.build();

      deepExtends(this._responses, builder.responses);
      deepExtends(this._definitions, builder.definitions);

      if (param.required) {
        this.addResponse400();
      }

      return Object.assign({}, param.store.get("baseParameter"), {
        in: ParamTypes.BODY,
        name: ParamTypes.BODY,
        description: "",
        required: !!param.required,
        schema: {
          $ref: `#/definitions/${param.typeName}`
        }
      });
    }

    let required = false;
    const model = `${this.name}Payload`;

    this._definitions[model] = params.reduce((acc: any, param) => {
      deepExtends(acc, this.createSchemaFromBodyParam(param));

      if (param.required) {
        this.addResponse400();
        required = true;
      }

      return acc;
    }, {});

    return {
      in: ParamTypes.BODY,
      name: ParamTypes.BODY,
      required,
      description: "",
      schema: {
        $ref: `#/definitions/${model}`
      }
    };
  }

  /**
   *
   * @returns {PathParameter[]}
   */
  private getInPathParams(): PathParameter[] {
    const inPathParams: PathParameter[] = [];
    const pathParams: Map<string, any> = new Map();

    this.injectedParams.forEach((param: ParamMetadata) => {
      if (param.paramType === ParamTypes.PATH) {
        pathParams.set(param.expression as any, param);
      }
    });

    this.pathParameters.forEach(pathParam => {
      if (pathParams.has(pathParam.name)) {
        const param = pathParams.get(pathParam.name);

        pathParam = Object.assign({}, pathParam, param.store.get("baseParameter") || {}, {
          type: swaggerType(param.type)
        });
      }

      inPathParams.push(Object.assign(pathParam, {required: true}));
    });

    return inPathParams;
  }

  /**
   *
   * @returns {HeaderParameter[]}
   */
  private getInQueryParams(): QueryParameter[] {
    return this.injectedParams.filter((param: ParamMetadata) => param.paramType === ParamTypes.QUERY).map(param => {
      if (param.required) {
        this.addResponse400();
      }

      return Object.assign(
        {},
        param.store.get("baseParameter"),
        {
          in: ParamTypes.QUERY,
          name: param.expression,
          required: !!param.required
        },
        this.createSchemaFromQueryParam(param)
      );
    });
  }

  /**
   * Create Properties schema from an expression.
   * @param param
   */
  private createSchemaFromExpression(param: ParamMetadata) {
    const schema: Schema = {};
    let current = schema;
    const expression: string = (param.expression as any) || "";

    if (!!expression) {
      const keys = expression.split(".");
      keys.forEach(key => {
        current.type = "object";
        current.properties = current.properties || {};
        current.properties![key] = {} as Schema;

        if (param.required) {
          current.required = [key];
        }

        current = current.properties![key];
      });
    }

    return {currentProperty: current, schema};
  }

  /**
   *
   * @param param
   * @returns {Schema}
   */
  protected createSchemaFromBodyParam(param: ParamMetadata): Schema {
    let builder;

    const {currentProperty, schema} = this.createSchemaFromExpression(param);

    if (param.isClass) {
      builder = new OpenApiModelSchemaBuilder(param.type);
      builder.build();

      deepExtends(this._definitions, builder.definitions);
      deepExtends(this._responses, builder.responses);
    }

    Object.assign(currentProperty, super.createSchema(param));

    return schema;
  }

  /**
   *
   * @param {ParamMetadata} model
   * @returns {Schema}
   */
  protected createSchemaFromQueryParam(model: ParamMetadata): Schema {
    const type = swaggerType(model.type);
    if (model.isCollection) {
      if (model.isArray) {
        return {
          type: "array",
          items: {
            type
          }
        };
      }

      return {
        type: "object",
        additionalProperties: {
          type
        }
      };
    }

    return {
      type
    };
  }

  private addResponse400() {
    this._responses[400] = {description: "Missing required parameter"};
  }

  public get parameters(): Parameter[] {
    return this._parameters;
  }
}
