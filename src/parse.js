/* jshint globalstrict: true*/
'use strict';

var ESCAPES = {
    'n': '\n',
    't': '\t',
    'f': '\f',
    'r': '\r',
    'v': '\v',
    '\'': '\'',
    '"': '"'
};

var OPERATORS = {
    'null': _.constant(null),
    'true': _.constant(true),
    'false': _.constant(false)
};

var ensureSafeMemberName = function(name) {
    if (name === 'constructor') {
        throw 'Referencing "constructor" field in expressions is disallowed!';
    }
    return name;
};

var ensureSafeObject = function(obj) {
    if (obj) {
        if (obj.document && obj.location && obj.alert && obj.setInterval) {
            throw 'Referencing window in Angular expressions is disallowed!';
        } else if (obj.children &&
            (obj.nodeName || (obj.prop && obj.attr && obj.find))) {
            throw 'Referencing DOM nodes in Angular expressions is disallowed!';
        } else if (obj.constructor === obj) {
			throw 'Referencing Function in Angular expressions is disallowed!'; 
		}
    }
    return obj;
};

var setter = function(object, path, value){
    // 嵌套时path为a.b
    var keys = path.split('.');
    while(keys.length > 1){
        var key = keys.shift();
        ensureSafeMemberName(key);

        // 要是我写的话，可能直接object = object[key] || {}了
        // 然而，这种||往往不靠谱，object[key] = null undefined 0 '' false也都不能认为是对象
        // 必须真的是这个key不存在才行
        if(!object.hasOwnProperty(key)){
            object[key] = {};
        }

        object = object[key];
    }

    object[keys.shift()] = value;
    return value;
};

function parse(expr) {

    switch (typeof expr) {
        case 'string':
            var lexer = new Lexer();
            var parser = new Parser(lexer);
            return parser.parse(expr);
        case 'function':
            return expr;
        default:
            return _.noop;
    }
}

// 词法分析器
function Lexer() {

}

Lexer.prototype.lex = function(text) {
    this.text = text;
    this.tokens = [];
    this.index = 0;
    this.ch = undefined;

    while (this.index < this.text.length) {

        // 这里为什么不直接用this.text[this.index] ?
        this.ch = this.text.charAt(this.index);

        if (this.isNumber(this.ch) || this.is('.') && this.isNumber(this.peek())) {
            this.readNumber();
        } else if (this.is('"\'')) {
            // String
            this.readString(this.ch);
        } else if (this.is('[],{}:.()=')) {
            this.tokens.push({
                text: this.ch,
                json: true
            });
            this.index++;
        } else if (this.isIdent(this.ch)) {
            // identifier
            // aKey['anotherKey']会生成一个token:{text:'aKey',fn:xxx}
            // 后面的['anotherKey']会生成其它3个token。
            // readIdent为什么不直接支持[]形式？而是在parser.primary()中处理
            // A：因为[]形式支持动态参数，所以这个必须由多个tokens组成，需要在解析器中做。点的形式key都是固定的
            this.readIdent();
        } else if (this.isWhitespace(this.ch)) {
            this.index++;
        } else {
            throw 'Unexpected next character:' + this.ch;
        }
    }

    return this.tokens;
};

Lexer.prototype.is = function(chs) {
    return chs.indexOf(this.ch) >= 0;
};

// 解析字符串，传入起始引号，用来判断结束引号是否和它匹配
Lexer.prototype.readString = function(quote) {
    this.index++; // 前面读取了引号，所以这里先加即可
    var rawString = quote;
    var string = '';
    var escape = false;
    while (this.index < this.text.length) {
        var ch = this.text.charAt(this.index);
        rawString += ch;

        if (escape) {
            // 转义

            if (ch === 'u') {
                // unicode
                // \u后4位
                var hex = this.text.substring(this.index + 1, this.index + 5);
                // 检验格式，正常的4位16进制数
                if (!hex.match(/[\da-f]{4}/i)) {
                    throw 'Invalid unicode escape';
                }

                this.index += 4;
                string = String.fromCharCode(parseInt(hex, 16));
            } else {
                var replacement = ESCAPES[ch];
                if (replacement) {
                    string += replacement;
                } else {
                    string += ch;
                }
            }

            escape = false;
        } else if (ch === quote) {

            // 读取到了引号，表示字符串终止
            this.index++;
            this.tokens.push({
                text: rawString, // rawString为带引号的字符串
                string: string,
                fn: _.constant(string),
                json: true
            });
            return;
        } else if (ch === '\\') {
            escape = true;
        } else {
            string += ch;
        }
        this.index++;
    }
    throw '未匹配的引号';
};

Lexer.prototype.isNumber = function(ch) {
    // 为什么不用 0 <= ch && ch <= 9?
    return '0' <= ch && ch <= '9';
};

Lexer.prototype.isExpOperator = function(ch) {
    return ch === '-' || ch === '+' || this.isNumber(ch);
};

Lexer.prototype.readNumber = function() {
    var number = '';
    while (this.index < this.text.length) {
        var ch = this.text.charAt(this.index).toLowerCase();
        if (ch === '.' || this.isNumber(ch)) {
            // Number
            number += ch;
        } else {

            // 科学计数
            var nextCh = this.peek();
            var prevCh = number.charAt(number.length - 1);

            if (ch === 'e' && this.isExpOperator(nextCh)) {
                number += ch;
            } else if (this.isExpOperator(ch) && prevCh === 'e' &&
                nextCh && this.isNumber(nextCh)) {
                number += ch;
            } else if (this.isExpOperator(ch) && prevCh === 'e' && (!nextCh || !this.isNumber(nextCh))) {
                throw "非法指数格式";
            } else {
                break;
            }
        }
        this.index++;
    }

    number = 1 * number;
    this.tokens.push({
        text: number,
        fn: _.constant(number),
        json: true
    });
};

// 返回下一个字符
Lexer.prototype.peek = function() {
    return this.index < this.text.length - 1 ? this.text.charAt(this.index + 1) : false;
};

Lexer.prototype.isIdent = function(ch) {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || ch === '$';
};

Lexer.prototype.readIdent = function() {
    var text = '';
    var start = this.index;
    var lastDotAt; // 一个连续的标识符最后一个点的位置
    while (this.index < this.text.length) {
        var ch = this.text.charAt(this.index);

        // 字母、数字、下划线、$
        if (ch === '.' || this.isIdent(ch) || this.isNumber(ch)) {
            if (ch === '.') {
                lastDotAt = this.index;
            }
            text += ch;
        } else {
            break;
        }
        this.index++;
    }

    // parse('obj.prop1.func()')
    // methodName: func()
    // text: obj.prop1
    // 不靠谱，如果func()后再跟属性获取呢？func().prop2
    var methodName;
    if (lastDotAt) {

        // func和()之间有空格
        var peekIndex = this.index;
        while (this.isWhitespace(this.text.charAt(peekIndex))) {
            peekIndex++;
        }

        if (this.text.charAt(peekIndex) === '(') {
            methodName = text.substring(lastDotAt - start + 1);
            text = text.substring(0, lastDotAt - start);
        }
    }

    var token = {
        text: text
    };

    if (OPERATORS.hasOwnProperty(text)) {
        token.fn = OPERATORS[text];
        token.json = true;
    } else {
        // 读取到一个变量 parse('test')
        token.fn = getterFn(text);
        token.fn.assign = function(self, value){
            return setter(self, text, value);
        };
    }

    this.tokens.push(token);

    if (methodName) {
        this.tokens.push({
            text: '.',
            json: false
        });

        this.tokens.push({
            text: methodName,
            fn: getterFn(methodName),
            json: false
        });
    }
};

var getterFn = _.memoize(function(ident) {
    var pathKeys = ident.split('.');
    if (pathKeys.length === 1) {
        ensureSafeMemberName(ident);
        return function(scope, locals) {
            if (locals && locals.hasOwnProperty(ident)) {
                return locals[ident];
            }
            return scope ? scope[ident] : undefined;
        };
    } else {
        return generatedGetterFn(pathKeys);
    }
});

var generatedGetterFn = function(keys) {
    // angular watch执行的次数比较多，如果采用迭代显然效率不好
    var code = '';

    _.forEach(keys, function(key, idx) {
        ensureSafeMemberName(key);
        code += 'if(!scope){return undefined;}\n';
        if (idx === 0) {
            // 嵌套结构，是否从locals中取只需判断locals[keys[0]]是否存在即可
            code += 'if(locals && locals.hasOwnProperty("' + key + '")){\n';
            code += 'scope = locals["' + key + '"];\n} else {\n';
            code += 'scope = scope["' + key + '"];\n}\n';
        } else {
            code += 'scope = scope["' + key + '"];\n';
        }
    });
    code += 'return scope;\n';

    /* jshint -W054 */
    // W054 表示 Function构造函数是eval的一种形式，jshint会提示错误，这里忽视
    return new Function('scope', 'locals', code);
    /* jshint +W054 */
};

Lexer.prototype.isWhitespace = function(ch) {
    return (ch === ' ' || ch === '\r' || ch === '\t' || ch === '\n' || ch === '\v' || ch === '\u00A0');
};


function Parser(lexer) {
    this.lexer = lexer;
}

/**
 * 解析表达式
 * @param  {[type]}   text expression
 * @return {Function}        
 */
Parser.prototype.parse = function(text) {
    this.tokens = this.lexer.lex(text);
    return this.assignment();
    // return this.primary(); // 实际是执行_.constant()方法
};

Parser.prototype.arrayDeclaration = function() {
    var elementFns = [];
    if (!this.peek(']')) {
        // 下一个token不是数组的结束符号
        do {
            if (this.peek(']')) {
                break;
            }
            elementFns.push(this.assignment());

        } while (this.expect(','));
    }
    this.consume(']');

    var arrayFn = function(self, locals) {
        var elements = _.map(elementFns, function(elementFn) {
            return elementFn(self, locals);
        });
        return elements;
    };

    arrayFn.literal = true;
    arrayFn.constant = _.every(elementFns, 'constant');
    return arrayFn;
};

Parser.prototype.object = function() {
    var keyValues = [];
    if (!this.peek('}')) {
        do {
            var keyToken = this.expect();
            this.consume(':');
            var valueExpression = this.assignment();
            // console.log(keyToken.string, keyToken.text);
            keyValues.push({
                key: keyToken.string || keyToken.text,
                value: valueExpression
            });
        } while (this.expect(','));

    }

    this.consume('}');

    var objectFn = function(scope, locals) {
        var object = {};
        _.forEach(keyValues, function(kv) {
            object[kv.key] = kv.value(scope, locals);
        });
        return object;
    };
    objectFn.literal = true;
    objectFn.constant = _.every(_.map(keyValues, 'value'), 'constant');
    return objectFn;
};

// 可以接收1个参数，当下一个token中的text为和指定参数一致时，移除并返回下一个token
// 或不接收参数，移除并返回下一个token，无则返回undefined
Parser.prototype.expect = function(e1, e2, e3, e4) {

    var token = this.peek(e1, e2, e3, e4);
    if (token) {
        return this.tokens.shift();
    }
};

Parser.prototype.consume = function(e) {
    if (!this.expect(e)) {
        throw 'Unexpected. Expectin ' + e;
    }
};

// 获取tokens中下一个该取的token，其实就是取第一个
Parser.prototype.peek = function(e1, e2, e3, e4) {
    if (this.tokens.length > 0) {
        var text = this.tokens[0].text;
        if (text === e1 || text === e2 || text === e3 || text === e4 || (!e1 && !e2 && !e3 && !e4)) {
            return this.tokens[0];
        }
    }
};

/**
 * 获取对象的属性
 * aKey[anotherKey]，objFn对应于aKey的token
 * @param  {function}   objFn 对象对应的token
 * @return {function}         对象属性对应的token
 */
Parser.prototype.objectIndex = function(objFn) {
    var indexFn = this.primary(); // 'anotherKey'对应的token

    this.consume(']');

    var objectIndexFn = function(scope, locals) {
        var obj = objFn(scope, locals); // scope.aKey
        var index = indexFn(scope, locals); // scope.anotherKey
        return ensureSafeObject(obj[index]); // scope.aKey[scope.anotherKey]
    };

    objectIndexFn.assign = function(self, value, locals){
        var obj = ensureSafeObject(objFn(self, locals));
        var index = indexFn(self, locals);
        return (obj[index] = value);
    };

    return objectIndexFn;
};

/**
 * aKey["anotherKey"].aThirdKey["aFourthKey"]
 * 解析到.的时候
 * objFn = aKey["anotherKey"] token
 * obj = scope.aKey["anotherKey"]
 * getter = aThirdKey fn
 */
Parser.prototype.fieldAccess = function(objFn) {
    var token = this.expect();
    var getter = this.fn;

    var fieldAccessFn = function(scope, locals) {
        var obj = objFn(scope, locals); // 在scope中找到objFn对应的key(aKey["anotherKey"]),scope.aKey['anotherKey']
        return getter(obj); // 在obj中找到getter对应的key，obj['aThirdKey']
    };

    fieldAccessFn.assign = function(self, value, locals){
        var obj = objFn(self, locals);
        return setter(obj, token.text, value);
    };

    return fieldAccessFn;
};

Parser.prototype.functionCall = function(fnFn, contextFn) {
    var argFns = [];
    if (!this.peek(')')) {
        do {
            argFns.push(this.primary());
        } while (this.expect(','));
    }

    this.consume(')');

    return function(scope, locals) {
        var context = ensureSafeObject(contextFn ? contextFn(scope, locals) : scope);
        var fn = ensureSafeObject(fnFn(scope, locals));
        var args = _.map(argFns, function(argFn) {
            return argFn(scope, locals);
        });
        return ensureSafeObject(fn.apply(context, args));
    };
};

Parser.prototype.assignment = function(){
    var left = this.primary();
    if(this.expect('=')){
        if(!left.assign){
            // 非变量
            throw 'Implies assignment but cannot be assigned to';
        }

        // =右侧具体的值
        var right = this.primary();
        return function(scope, locals){
            return left.assign(scope, right(scope, locals), locals);
        };
    }
    return left;
};

Parser.prototype.primary = function() {
    var primary;
    if (this.expect('[')) {
        // 去获取数值
        primary = this.arrayDeclaration();
    } else if (this.expect('{')) {
        primary = this.object();
    } else {
        // 如果是一个标识符，不出意外，你取到了，但是aIdentifier['xx']不是跪了吗？
        var token = this.expect();
        primary = token.fn;
        if (token.json) {
            primary.constant = true;
            primary.literal = true;
        }
    }

    // 这个为什么要写在这里？不是应该写在readIdent中吗？原因看上
    // 很显然了，这里就是解决标识符后跟了其它内容的情况，当然可以aKey.anotherKey可以aKey['anotherKey']
    var next;
    var context; // 执行上下文，便于正确处理函数调用中的this
    while ((next = this.expect('[', '.', '('))) {
        // 常规表达式走完后将this.tokens将为空
        // 执行到这里，说明表达式是一个对象，要获取属性
        if (next.text === '[') {
            context = primary; // 接下来可能是个函数调用，先记录下这个上下文
            primary = this.objectIndex(primary);
        } else if (next.text === '.') {
            context = primary;
            primary = this.fieldAccess(primary);
        } else if (next.text === '(') {
            // 将进行函数调用
            primary = this.functionCall(primary, context);

            context = undefined; // 执行函数后，则清楚上下文，否则this指向错误
        }
    }

    return primary;
};