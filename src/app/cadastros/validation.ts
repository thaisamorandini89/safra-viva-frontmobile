import { normalizeCep } from './cep';

export type CadastroKind = 'propriedade' | 'talhao';
export type CadastroFields = Record<string, string>;
export type CadastroPayload = Record<string, string | number>;
export type CadastroErrors = Record<string, string>;

export type PropertyOption = {
  id_propriedade: number;
  id_empresa: number | null;
  nome_propriedade: string;
};

export function parseNumber(value: string): number | undefined {
  const text = value.trim();
  if (!text) {
    return undefined;
  }
  const normalized = text.includes(',')
    ? text.replace(/\./g, '').replace(',', '.')
    : text;
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) {
    return NaN;
  }
  return Number(normalized);
}

export function validateCadastro(
  kind: CadastroKind,
  fields: CadastroFields,
  companyId: number | null,
  properties: PropertyOption[],
): { errors: CadastroErrors; payload: CadastroPayload } {
  const errors: CadastroErrors = {};
  const payload: CadastroPayload = {};
  const text = (name: string, label: string, required = false) => {
    const value = (fields[name] ?? '').trim();
    if (!value && required) {
      errors[name] = `Informe ${label}.`;
    } else if (value) {
      payload[name] = value;
    }
  };
  const number = (
    name: string,
    label: string,
    options: {
      required?: boolean;
      min?: number;
      max?: number;
      integer?: boolean;
      positive?: boolean;
    } = {},
  ) => {
    const value = parseNumber(fields[name] ?? '');
    if (value === undefined) {
      if (options.required) {
        errors[name] = `Informe ${label}.`;
      }
      return;
    }
    if (
      !Number.isFinite(value) ||
      (options.integer && !Number.isInteger(value)) ||
      (options.positive && value <= 0) ||
      (options.min !== undefined && value < options.min) ||
      (options.max !== undefined && value > options.max)
    ) {
      errors[name] = `Informe ${label} válido.`;
    } else {
      payload[name] = value;
    }
  };

  if (!Number.isSafeInteger(companyId) || !companyId || companyId < 1) {
    errors.empresa = 'Sua conta precisa estar vinculada a uma empresa.';
  }
  if (kind === 'propriedade') {
    if (companyId) {
      payload.id_empresa = companyId;
    }
    text('nome_propriedade', 'o nome da propriedade', true);
    text('car', 'o CAR', true);
    number('latitude', 'uma latitude', { required: true, min: -90, max: 90 });
    number('longitude', 'uma longitude', {
      required: true,
      min: -180,
      max: 180,
    });
    number('area_total', 'uma área total', { required: true, positive: true });
    number('area_agricultavel', 'uma área agricultável', {
      required: true,
      min: 0,
    });
    number('area_preservacao', 'uma área de preservação', {
      required: true,
      min: 0,
    });
    number('area_pastagem', 'uma área de pastagem', { min: 0 });
    number('area_vegetacao_nativa', 'uma área de vegetação nativa', { min: 0 });
    number('altitude_media', 'uma altitude inteira', { integer: true });
    ['ccir', 'nirf', 'ponto_referencia', 'observacoes'].forEach(name =>
      text(name, name),
    );
    ['id_tipo_solo', 'id_classe_capacidade_uso'].forEach(name =>
      number(name, 'uma opção', { positive: true, integer: true }),
    );
    const addressFields = [
      'cep',
      'id_estado',
      'id_cidade',
      'logradouro',
      'bairro',
      'numero',
      'complemento',
    ];
    if (addressFields.some(name => (fields[name] ?? '').trim())) {
      const cep = normalizeCep(fields.cep ?? '');
      if (!cep) {
        errors.cep = 'Informe um CEP com 8 dígitos para salvar o endereço.';
      } else {
        payload.cep = cep;
      }
      number('id_cidade', 'a cidade', {
        required: true,
        positive: true,
        integer: true,
      });
      text('logradouro', 'o logradouro', true);
      ['bairro', 'numero', 'complemento'].forEach(name => text(name, name));
    }
  } else {
    text('nome_talhao', 'o nome do talhão', true);
    text('codigo_talhao', 'o código do talhão', true);
    const propertyId = Number(fields.id_propriedade);
    if (
      !properties.some(
        item =>
          item.id_propriedade === propertyId &&
          item.id_empresa === companyId &&
          companyId !== null,
      )
    ) {
      errors.id_propriedade = 'Selecione uma propriedade da sua empresa.';
    } else {
      payload.id_propriedade = propertyId;
    }
    number('area_total', 'uma área total', { required: true, positive: true });
    number('area_utilizavel', 'uma área utilizável', { min: 0 });
    if (
      typeof payload.area_total === 'number' &&
      typeof payload.area_utilizavel === 'number' &&
      payload.area_utilizavel > payload.area_total
    ) {
      errors.area_utilizavel =
        'A área utilizável não pode superar a área total.';
    }
    number('latitude', 'uma latitude', { min: -90, max: 90 });
    number('longitude', 'uma longitude', { min: -180, max: 180 });
    number('id_tipo_solo', 'um tipo de solo', {
      positive: true,
      integer: true,
    });
    ['status_inicial', 'topografia', 'observacoes'].forEach(name =>
      text(name, name),
    );
  }
  return { errors, payload };
}
