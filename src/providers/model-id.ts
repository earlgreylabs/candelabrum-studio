// AI SDK model arguments are `string | ModelObject`; when a bare string is
// passed it is itself the model id. Normalise to the id string for cost tracking.
export function modelIdOf(model: string | { readonly modelId: string }): string {
  return typeof model === "string" ? model : model.modelId;
}
