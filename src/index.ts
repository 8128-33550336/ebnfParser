export type sequence<T> = { type: 'sequence', defs: T; };
export type or<T> = { type: 'or', defs: T[]; };
export type capture<N extends string, T> = { type: 'capture', key: N, def: T; };
export type repeat<T> = { type: 'repeat', def: T; };
type range = { type: 'range', from: number, to: number; };
type without<T, S> = { type: 'without', def: T; without: S; };
export type recursion<T> = { type: 'recursion', def: T | undefined; };
export type str<T extends string> = { type: 'str', str: T; };

export type none = { type: 'none'; };

export type withParser<I, O> = { type: 'withParser'; def: I; func: (def: parsedType<I>) => O; };

type defKeys = none | str<string> | recDef | orDef | range | seqDef | repDef | withoutDef | capDef | withParserDef;

interface recDef extends recursion<defKeys> { }

interface orDef extends or<defKeys> { }

interface seqDef extends sequence<defKeys[]> { }

interface repDef extends repeat<defKeys> { }

interface withoutDef extends without<defKeys, defKeys> { }

interface capDef extends capture<string, defKeys> { }

interface withParserDef extends withParser<defKeys, unknown> { }


export const def = {
    str<T extends string>(str: T): str<T> {
        return { type: 'str', str };
    },
    strOr<T extends string>(...string: T[]): or<str<T>> {
        return { type: 'or', defs: string.map(s => this.str(s)) };
    },
    or<T extends defKeys>(...defs: T[][]): or<T> {
        return { type: 'or', defs: defs.flat() };
    },
    range(from: string, to: string): range {
        if ([ ...from ].length !== 1) {
            throw new Error(`from args must be char got: ${from}`);
        }
        if ([ ...to ].length !== 1) {
            throw new Error(`to args must be char got: ${to}`);
        }
        const fromCode = from.codePointAt(0) ?? 0;
        const toCode = to.codePointAt(0) ?? 0;
        if (fromCode > toCode) {
            throw new Error('args must be (from char code) >= (to char code)');
        }
        return { type: 'range', from: fromCode, to: toCode };
    },
    sequence<T extends defKeys[]>(...defs: [ ...T ]): sequence<T> {
        return { type: 'sequence', defs };
    },
    optional<T extends defKeys>(def: T): or<T | none> {
        return { type: 'or', defs: [ def, { type: 'none' } ] };
    },
    repeat<T extends defKeys>(def: T): repeat<T> {
        return { type: 'repeat', def: def };
    },
    repeatAtLeast<T extends defKeys>(def: T): sequence<[ T, repeat<T> ]> {
        return { type: 'sequence', defs: [ def, { type: 'repeat', def: def } ] };
    },
    capture<N extends string, T extends defKeys>(name: N, def: T): capture<N, T> {
        return { type: 'capture', key: name, def };
    },
    repeatFixed<T extends defKeys>(def: T, times: number): sequence<T[]> {
        return { type: 'sequence', defs: Array(times).fill(def) };
    },
    repeatAlter<T extends defKeys, S extends defKeys>(first: T, second: S): sequence<[ T, repeat<sequence<[ S, T ]>> ]> {
        return { type: 'sequence', defs: [ first, { type: 'repeat', def: { type: 'sequence', defs: [ second, first ] } } ] };
    },
    without<T extends defKeys, S extends defKeys>(base: T, without: S): without<T, S> {
        return { type: 'without', def: base, without };
    },
    createRecursion<T extends defKeys>(): [ recursion<T>, <S extends T>(def: S) => S ] {
        const sym: recursion<T> = { type: 'recursion', def: undefined };
        return [ sym, (def) => {
            sym.def = def;
            return def;
        } ];
    },
    withParser<I extends defKeys, O>(def: I, func: (def: parsedType<I>) => O): withParser<I, O> {
        return { type: 'withParser', def, func } as any;
    },
};


export type parsedType<T> =
    T extends none ? null :
    T extends str<infer T> ? T :
    T extends recursion<infer S> ? parsedType<S> :
    T extends or<infer S> ? parsedType<S> :
    T extends range ? string :
    T extends sequence<infer S> ? { [ U in keyof S ]: parsedType<S[ U ]> } :
    T extends repeat<infer S> ? parsedType<S>[] :
    T extends without<infer S, infer U> ? Exclude<parsedType<S>, parsedType<U>> :
    T extends capture<infer N, infer S> ? { type: N, value: parsedType<S>; } :
    T extends withParser<unknown, infer O> ? O :
    never;



function parseInternal<T extends defKeys>(def: T, str: string): [ unknown, number ] {
    switch (def.type) {
        case 'str': {
            if (str.startsWith(def.str)) {
                return [ def.str, def.str.length ];
            } else {
                if (str.length) {

                    throw new Error(`parse error: expect: ${def.str}, but got: [${str.slice(0, def.str.length)}](${def.str.length})`);
                }
                throw new Error(`parse error: expect: ${def.str}, but got noting`);
            }
        }
        case 'range': {
            const first = [ ...str ][ 0 ];
            if (first === undefined) {
                throw new Error(`parse error: expect some char, but got noting`);
            }
            const charCode = first.codePointAt(0);
            if (charCode === undefined) {
                throw new Error(`parse error: expect some char, but got noting`);
            }
            if (charCode >= def.from && charCode <= def.to) {
                return [ first, first.length ];
            }
            throw new Error(`parse error: expect ${def.from} <= ${charCode}(${first}) <= ${def.to}but ... `);
        }
        case 'capture': {
            try {
                const [ val, len ] = parseInternal(def.def, str);
                return [ { type: def.key, value: val }, len ];
            } catch (error) {
                throw new Error(`(${def.key})` + error);
            }
        }
        case 'recursion': {
            if (def.def === undefined) {
                throw new Error(`parse error: recursion not resolved`);
            }
            const [ val, len ] = parseInternal(def.def, str);
            return [ val, len ];
        }
        case 'sequence': {
            const [ val, len ] = def.defs.reduce<[ unknown[], number ]>((prev, curr) => {
                const [ val, len ] = parseInternal(curr, str.slice(prev[ 1 ]));
                return [ [ ...prev[ 0 ], val ], prev[ 1 ] + len ];
            }, [ [], 0 ]);
            return [ val, len ];
        }
        case 'repeat': {
            const val = [];
            let len = 0;
            while (true) {
                try {
                    const [ v, l ] = parseInternal(def.def, str.slice(len));
                    val.push(v);
                    len += l;
                } catch {
                    break;
                }
            }
            return [ val, len ];
        }
        case 'without': {
            const [ val, len ] = parseInternal(def.def, str);
            try {
                parseInternal(def.without, str);
            } catch {
                return [ val, len ];
            }
            throw new Error(`parse error: The conditions for exclusion were met.`);
        }
        case 'none': {
            return [ null, 0 ];
        }
        case 'or': {
            const errors: string[] = [];
            for (const defItem of def.defs) {
                try {
                    const [ val, len ] = parseInternal(defItem, str);
                    return [ val, len ];
                } catch (error) {
                    errors.push('' + error);
                }
            }
            throw new Error(`parse error: Does not apply to any of defs: ${errors.join(', \n')}`);
        }
        case 'withParser': {
            const [ val, len ] = parseInternal(def.def, str);
            const c = (def.func as any)(val);
            return [ c, len ];
        }
        default: {
            const _: never = def;
            return [ _, 0 ];
        }
    }
}


export function parse<T extends defKeys>(def: T, str: string): parsedType<T> {
    const [ val, len ] = parseInternal(def, str);
    if (len === str.length) {
        return val as parsedType<T>;
    }
    throw new Error(`parsed: [${val}], (${str.slice(0, len)})(${len}) cant parse after '${str.slice(len)}'`);
}

export function validate(def: defKeys, str: string): boolean {
    try {
        const [ , len ] = parseInternal(def, str);
        return len === str.length;
    } catch {
        return false;
    }
}
