import { capture, def, none, or, parse, parsedType, recursion, repeat, sequence, str, validate, withParser } from "./index";

// (' ', '\n', '\r', '\t')[]
const whiteSpace = def.repeat(def.strOr(' ', '\n', '\r', '\t'));

// string
const digit19 = def.range('1', '9');

// '0' | string -> string

const digit19WithParser = def.withParser(digit19, (def) => {
    switch (def) {
        case '1': {
            return 1;
        }
        case '2': {
            return 2;
        }
        case '3': {
            return 3;
        }
        case '4': {
            return 4;
        }
        case '5': {
            return 5;
        }
        case '6': {
            return 6;
        }
        case '7': {
            return 7;
        }
        case '8': {
            return 8;
        }
        case '9': {
            return 9;
        }
    }
    throw new Error('parse error range error');
});

const digit = def.or([ def.str('0'), digit19WithParser ]);

const digitWithParser = def.withParser(digit, (def) => {
    if (def === '0') {
        return 0;
    }
    return def;
});

// string | string | string -> string
const hexDigit = def.or([ digitWithParser, def.range('a', 'f'), def.range('A', 'Z') ]);

const hexDigitWithParser = def.withParser(hexDigit, (def) => {
    if (typeof def === 'number') {
        return def;
    }
    switch (def) {
        case 'a':
        case 'A': {
            return 0xa;
        }
        case 'b':
        case 'B': {
            return 0xb;
        }
        case 'c':
        case 'C': {
            return 0xc;
        }
        case 'd':
        case 'D': {
            return 0xd;
        }
        case 'e':
        case 'E': {
            return 0xe;
        }
        case 'f':
        case 'F': {
            return 0xf;
        }
        default: {
            throw new Error('parse error range error');
        }
    }
});

// ['-' | null, '0' | [string, string[]], ['.', string[]] | null, ['e' | 'E', '+' | '-' | null, string[]] | null]
const number = def.sequence(
    def.optional(def.str('-')),
    def.or([ def.str('0'), def.sequence(digit19WithParser, def.repeat(digitWithParser)) ]),
    def.optional(def.sequence(def.str('.'), def.repeatAtLeast(digitWithParser))),
    def.optional(def.sequence(
        def.strOr('e', 'E') satisfies or<str<'e' | 'E'>>,
        def.optional(def.strOr('+', '-')) satisfies or<or<str<'+' | '-'>> | none>,
        def.repeatAtLeast(digitWithParser),
    ))
);

const numberWithParser = def.withParser(number, (num) => {
    const isMinus = num[ 0 ] === '-';
    const int = ((int) => {
        if (int === '0') {
            return 0;
        }

        let num = int[ 0 ];
        for (const digit of int[ 1 ]) {
            num *= 10;
            num += digit;
        }
        return num;
    })(num[ 1 ]);
    const frac = ((frac) => {
        if (frac === null) {
            return 0;
        }
        const digits = [ frac[ 1 ][ 0 ], ...frac[ 1 ][ 1 ] ];
        let num = 0;
        for (const digit of [ ...digits ].reverse()) {
            num += digit;
            num /= 10;
        }
        return num;
    })(num[ 2 ]);
    const exp = ((exp) => {
        if (exp === null) {
            return 1;
        }
        const isMinus = exp[ 1 ] === '-';

        let num = exp[ 2 ][ 0 ];
        for (const digit of exp[ 2 ][ 1 ]) {
            num *= 10;
            num += digit;
        }
        const e = isMinus ? - num : num;
        return Math.pow(10, e);
    })(num[ 3 ]);
    return (isMinus ? -1 : 1) * (int + frac) * exp;
});

const string = def.sequence(
    def.str('"'),
    def.repeat(def.or([
        // /[^"\\]/,
        def.without(def.range('\u0020', '\u{10ffff}'), def.strOr('"', '\\')),
        def.sequence(def.str('\\'), def.or([
            def.strOr(
                '"',
                '\\',
                '/',
                'b',
                'f',
                'n',
                'r',
                't',
            ),
            def.sequence(def.str('u'), def.repeatFixed(hexDigitWithParser, 4))
        ]))
    ])),
    def.str('"'),
);

const stringWithParser = def.withParser(string, (def) => {
    const str: string[] = [];
    for (let i = 0; i < def[ 1 ].length; i++) {
        const char = def[ 1 ][ i ];
        if (char === undefined) {
            throw new Error('parse error range error');
        }
        if (typeof char === 'string') {
            str.push(char);
            continue;
        }
        const c = char[ 1 ];
        switch (c) {
            case '"': {
                str.push('"');
                break;
            }
            case '/': {
                str.push('/');
                break;
            }
            case '\\': {
                str.push('\\');
                break;
            }
            case 'b': {
                str.push('\b');
                break;
            }
            case 'f': {
                str.push('\f');
                break;
            }
            case 'n': {
                str.push('\n');
                break;
            }
            case 'r': {
                str.push('\r');
                break;
            }
            case 't': {
                str.push('\t');
                break;
            }
            default: {
                const code = c[ 1 ];
                if (code.length !== 4) {
                    throw new Error('parse error code length error');
                }
                let num = 0;
                for (const co of code) {
                    num *= 10;
                    num += co;
                }
                str.push(String.fromCodePoint(num));
                break;
            }
        }

    }
    return str.join('');
});


const [ objectDef, setObjectDef ] = def.createRecursion<objectType>();
const [ arrayDef, setArrayDef ] = def.createRecursion<arrayType>();
const [ valueDef, setValueDef ] = def.createRecursion<valueType>();

type valueType = sequence<[
    typeof whiteSpace,
    or<
        or<str<"true" | "false" | "null">> |
        capture<"number", typeof numberWithParser> |
        capture<"string", typeof stringWithParser> |
        capture<"object", recursion<objectType>> |
        capture<"array", recursion<arrayType>>
    >,
    typeof whiteSpace
]>;

type arrayType = sequence<[
    str<"[">,
    or<
        | capture<"empty", typeof whiteSpace>
        | capture<"items", sequence<[ recursion<valueType>, repeat<sequence<[ str<",">, recursion<valueType> ]>> ]>>>,
    str<"]">
]>;

type objectType = sequence<[
    str<"{">,
    or<
        | capture<'empty', typeof whiteSpace>
        | capture<'pair', sequence<[
            sequence<[
                typeof whiteSpace,
                typeof stringWithParser,
                typeof whiteSpace,
                str<":">,
                recursion<valueType>
            ]>,
            repeat<
                sequence<[
                    str<",">,
                    sequence<[
                        typeof whiteSpace,
                        typeof stringWithParser,
                        typeof whiteSpace,
                        str<":">,
                        recursion<valueType>
                    ]>,
                ]>
            >,
        ]>>
    >,
    str<"}">
]>;

const value = def.sequence(
    whiteSpace,
    def.or([
        def.strOr(
            'true',
            'false',
            'null',
        ),
        def.capture('number', numberWithParser),
        def.capture('string', stringWithParser),
        def.capture('object', objectDef),
        def.capture('array', arrayDef),
    ]),
    whiteSpace
);

const array = def.sequence(
    def.str('['),
    def.or([
        def.capture('items', def.repeatAlter(valueDef, def.str(','))),
        def.capture('empty', whiteSpace),
    ]),
    def.str(']')
);

const object = def.sequence(
    def.str('{'),
    def.or([
        def.capture('pair', def.repeatAlter(
            def.sequence(
                whiteSpace,
                stringWithParser,
                whiteSpace,
                def.str(':'),
                valueDef
            ),
            def.str(',')
        )),
        def.capture('empty', whiteSpace),
    ]),
    def.str('}')
);

type value = boolean | null | number | string | value[] | { [ P in string ]?: value };

const valueFunc = (v: parsedType<valueType>): value => {
    switch (v[ 1 ]) {
        case 'true': {
            return true;
        }
        case 'false': {
            return false;
        }
        case 'null': {
            return null;
        }
        default: {
            switch (v[ 1 ].type) {
                case 'string': {
                    return v[ 1 ].value;
                }
                case 'number': {
                    return v[ 1 ].value;
                }
                case 'array': {
                    return arrayFunc(v[ 1 ].value);
                }
                case 'object': {
                    return objectFunc(v[ 1 ].value);
                }
            }
        }
    }
};

const arrayFunc = (def: parsedType<arrayType>) => {
    if (def[ 1 ].type === 'empty') {
        return [];
    }
    const arr = [
        def[ 1 ].value[ 0 ],
        ...def[ 1 ].value[ 1 ].map(v => v[ 1 ])
    ].map((item) => valueFunc(item));
    return arr;
};

const objectFunc = (def: parsedType<objectType>) => {
    if (def[ 1 ].type === 'empty') {
        return {};
    }

    const obj: { [ P in string ]?: value } = {};
    for (const pair of [ def[ 1 ].value[ 0 ], ...def[ 1 ].value[ 1 ].map(v => v[ 1 ]) ]) {
        const p: parsedType<sequence<[
            typeof whiteSpace,
            typeof stringWithParser,
            typeof whiteSpace,
            str<":">,
            recursion<valueType>
        ]>> = pair;
        const key = p[ 1 ];
        const value = valueFunc(p[ 4 ]);
        obj[ key ] = value;
    }
    return obj;
};

const valueWithParser = def.withParser(value, valueFunc);

setValueDef(value);
setArrayDef(array);
setObjectDef(object);

describe('text obj', () => {
    describe('json', () => {
        describe('whitespace', () => {
            test('validate', () => {
                expect(validate(whiteSpace, '    ')).toBe(true);
            });
            test('validate', () => {
                expect(validate(whiteSpace, ' \n\t\r   ')).toBe(true);
            });
            test('validate', () => {
                expect(validate(whiteSpace, '    a   ')).toBe(false);
            });
            test('parse', () => {
                expect(() => {
                    parse(whiteSpace, '    a   ');
                }).toThrow();
            });
            test('parse', () => {
                const c = parse(whiteSpace, '   \n\n\r\t\t\t   \n');
                expect(c).toEqual([ ' ', ' ', ' ', '\n', '\n', '\r', '\t', '\t', '\t', ' ', ' ', ' ', '\n' ]);
            });
        });
        describe('number', () => {
            test('validate', () => {
                expect(validate(number, '0')).toBe(true);
                expect(validate(number, '-0')).toBe(true);
                expect(validate(number, '-3.09e2')).toBe(true);
                expect(validate(number, '00')).toBe(false);
                expect(validate(number, '0.')).toBe(false);
                expect(validate(number, '.f')).toBe(false);
                expect(validate(number, '0.e')).toBe(false);
            });
            test('parse', () => {
                const c = parse(number, '0');
                expect(c).toEqual([ null, '0', null, null ]);
            });
            test('parse', () => {
                const c = parse(number, '-0');
                expect(c).toEqual([ '-', '0', null, null ]);
            });
            test('parse type check', () => {
                type digit19Type = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
                type numType = [ '-' | null, '0' | [ digit19Type, (digit19Type | 0)[] ], [ '.', [ (digit19Type | 0), (digit19Type | 0)[] ] ] | null, [ 'e' | 'E', '+' | '-' | null, [ (digit19Type | 0), (digit19Type | 0)[] ] ] | null ];
                //             [ "-" | null, "0" | [string, string[]], [string, string[]] | null, ["e" | "E", '+' | '-' | null, string[]] | null]
                const c = parse(number, '-3.09e2');
                const _: numType = c;
            });
            test('parse', () => {
                const c = parse(number, '-3.09e2');
                expect(c).toEqual([
                    '-',
                    [ 3, [] ],
                    [ '.', [ 0, [ 9 ] ] ],
                    [ 'e', null, [ 2, [] ] ],
                ]);
            });
            test('parseWithParser', () => {
                const c = parse(numberWithParser, '-3.09e2');
                expect(c).toBe(-309);
            });
        });
        describe('string', () => {
            test('parse', () => {
                const c = parse(stringWithParser, '"sss"');
                expect(c).toBe('sss');
            });
            test('parse', () => {
                const c = parse(stringWithParser, '"\\\\\\"\\n"');
                expect(c).toBe('\\\"\n');
            });
        });
        describe('json', () => {
            test('parse', () => {
                const jsonStr = `
                    {
                        "abc": 0
                    }
                `;
                const c = parse(valueWithParser, jsonStr);
                expect(c).toEqual({
                    abc: 0
                });
            });
            test('parse', () => {
                const jsonStr = `
                    {
                        "abc": 0,
                        "def": {
                            "ghi": [],
                            "dd": {},
                            "ff": {
                                "a": false,
                                "v": [{}, false, true, null],
                                "b": [{
                                    "abc": 0
                                }]
                            }
                        }
                    }
                `;
                const c = parse(valueWithParser, jsonStr);
                expect(c).toEqual(JSON.parse(jsonStr));
            });
        });
    });
});

describe('test ebnf', () => {

});
