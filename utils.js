
export const toNames = (name) => {
    const capitalize = (s) => s.substring(0, 1).toUpperCase() + s.substring(1);

    // Convert a string to HTML kebab-cases and javascript camelCases
    const [first, ...rest] = Array.from(name.matchAll(/([A-Z]*[a-z0-9]+)|([A-Z]+)/g), x => x[0]);
    const cssWords = [first, ...rest].map((s) => s.toLowerCase());
    const variableWords = [first.toLowerCase()].concat(rest.map(capitalize));
    const classWords = [first, ...rest].map(capitalize);

    return {
        'cssName': cssWords.join('-'),
        'variableName': variableWords.join(''),
        'className': classWords.join(''),
    }
}
