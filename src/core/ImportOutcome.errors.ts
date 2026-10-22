/**
 * An import reached the worker's swap, and no answer followed within the bound. The world may or may not have been
 * replaced, so the import is neither a failure nor a success. Only a reload shows the world the worker holds.
 */
export class ImportOutcomeUnknownError extends Error {
    constructor() {
        super('The import may or may not have been applied, because the worker did not confirm it. Reload the page to see the world it holds.');
        this.name = 'ImportOutcomeUnknownError';
    }
}
