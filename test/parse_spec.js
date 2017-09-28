/* jshint globalstrict: true */
/* global parse: false */
'use strict';
describe('parse', function() {

    it('==解析整数', function() {
        var fn = parse('12');
        expect(fn).toBeDefined();
        expect(fn()).toBe(12);
    });

    it('----整数是常量也是字面量', function() {
        var fn = parse('12');
        expect(fn.constant).toBe(true);
        expect(fn.literal).toBe(true);
    });

    it("==解析浮点数", function() {
        var fn = parse('4.2');
        expect(fn()).toBe(4.2);
    });

    it("----解析不带整数部分的浮点数", function() {
        var fn = parse('.42');
        expect(fn()).toBe(0.42);
    });

    it("==解析科学计数", function() {
        var fn = parse('42e3');
        expect(fn()).toBe(42000);
    });

    it("----解析浮点数系数的科学计数", function() {
        var fn = parse('.42e3');
        expect(fn()).toBe(420);
    });

    it("----解析指数为负数的科学计数", function() {
        var fn = parse('42e-3');
        expect(fn()).toBe(0.042);
    });

    it("----解析指数带有+号的科学计数", function() {
        var fn = parse('42e+3');
        expect(fn()).toBe(42000);
    });

    it("----解析大写E科学计数", function() {
        var fn = parse('42e+3');
        expect(fn()).toBe(42000);
    });

    it("----不解析错误格式的科学计数", function() {
        expect(function() { parse('42e-'); }).toThrow();
        expect(function() { parse('42e-a'); }).toThrow();
    });

    it("==解析单引号字符串", function() {
        var fn = parse("'abc'");
        expect(fn()).toEqual('abc');
    });

    it("==解析双引号字符串", function() {
        var fn = parse('"abc"');
        expect(fn()).toEqual('abc');
    });

    it("----不解析不匹配的引号", function() {
        expect(function() { parse("abc\'"); }).toThrow();
    });

    it('----字符串是常量也是字面量', function() {
        var fn = parse('"abc"');
        expect(fn.constant).toBe(true);
        expect(fn.literal).toBe(true);
    });

    it('----正常解析转义字符', function() {
        var fn = parse('"\\n\\r\\\\"');
        expect(fn()).toEqual("\n\r\\");
    });

    it('----正常解析转义字符2', function() {
        var fn1 = parse('"\\a\c\\\\"');
        var fn2 = parse('"\a\c\\\\"'); // 我很纳闷，为什么这两种结果一样？
        expect(fn1()).toEqual("\a\c\\");
        expect(fn2()).toEqual("\a\c\\");
    });

    it('==解析unicode字符', function() {
        var fn = parse('"\\u00A0"');
        expect(fn()).toEqual("\u00A0");
    });

    it('----错误的unicode字符抛异常', function() {
        expect(function() {
            parse('"\\u00T0"');
        }).toThrow();
    });

    it('==解析null', function() {
        var fn = parse('null');
        expect(fn()).toBe(null);
    });

    it('==解析true', function() {
        var fn = parse('true');
        expect(fn()).toBe(true);
    });

    it('==解析false', function() {
        var fn = parse('false');
        expect(fn()).toBe(false);
    });

    it('----布尔值标记为常量和字面量', function() {
        var fn = parse('true');
        expect(fn.constant).toBe(true);
        expect(fn.literal).toBe(true);
    });

    it('==忽略空白符', function() {
        var fn = parse(' \n42');
        expect(fn()).toBe(42);
    });

    it('==解析空数组', function() {
        var fn = parse('[]');
        expect(fn()).toEqual([]);
    });

    it('----解析非空数组', function() {
        var fn = parse('[1,"two",[3]]');
        expect(fn()).toEqual([1, 'two', [3]]);
    });

    it('----解析结尾为逗号的数组', function() {
        var fn = parse('[1,2,3]');
        expect(fn()).toEqual([1, 2, 3]);
    });

    it('----数组标记为常量和字面量', function() {
        var fn = parse('[1,2,3]');
        expect(fn.constant).toBe(true);
        expect(fn.literal).toBe(true);
    });

    it('==解析空对象', function() {
        var fn = parse('{}');
        expect(fn()).toEqual({});
    });

    it('----解析非空对象', function() {
        var fn = parse('{a:1,b:[2,3],c:{d:4}}');
        expect(fn()).toEqual({ a: 1, b: [2, 3], c: { d: 4 } });
    });

    it('----解析非空对象，key为带引号的', function() {
        var fn = parse('{"a key":1,\'b-key\':[2,3],c:{d:4}}');
        expect(fn()).toEqual({ 'a key': 1, 'b-key': [2, 3], c: { d: 4 } });
    });

    it('==解析函数', function() {
        var fn = function() {};
        expect(parse(fn)).toBe(fn);
    });

    it('----无参数的parse仍然解析成function', function() {
        var fn = function() {};
        expect(parse()).toEqual(jasmine.any(Function));
    });

    it('==从scope上找到一个属性', function() {
        var fn = parse('aKey');
        expect(fn({ aKey: 42 })).toBe(42);
        expect(fn({})).toBeUndefined();
        expect(fn()).toBeUndefined();
    });

    it('----寻找scope中第二级调用的属性', function() {
        var fn = parse('aKey.anotherKey');
        expect(fn({ aKey: { anotherKey: 42 } })).toBe(42);
        expect(fn({ aKey: {} })).toBeUndefined();
        expect(fn()).toBeUndefined();
    });

    it('----寻找scope中第N级调用的属性', function() {
        var fn = parse('aKey.secondKey.thirdKey.fourthKey');
        expect(fn({ aKey: { secondKey: { thirdKey: { fourthKey: 42 } } } })).toBe(42);
        expect(fn({ aKey: { secondKey: { thirdKey: {} } } })).toBeUndefined();
        expect(fn({ aKey: {} })).toBeUndefined();
        expect(fn()).toBeUndefined();
    });

    it('----当locals中匹配到key时使用传入的局部变量而不是scope', function() {
        var fn = parse('aKey');
        expect(fn({ aKey: 42 }, { aKey: 43 })).toBe(43);
    });

    it('----locals中未找到key时则回退到scope上寻找', function() {
        var fn = parse('aKey');
        expect(fn({ aKey: 42 }, { otherKey: 43 })).toBe(42);
    });

    it('----locals中存在则直接使用locals的值', function() {
        var fn = parse('aKey.anotherKey');
        expect(fn({ aKey: { anotherKey: 42 } }, { aKey: { anotherKey: 43 } })).toBe(43);
    });
    it('----locals不存在key时从scope中找', function() {
        var fn = parse('aKey.anotherKey');
        expect(fn({ aKey: { anotherKey: 42 } }, { otherKey: { anotherKey: 43 } })).toBe(42);
    });
    it('----locals中第一个key存在则在locals中找', function() {
        var fn = parse('aKey.anotherKey');
        expect(fn({ aKey: { anotherKey: 42 } }, { aKey: {} })).toBeUndefined();
    });

    it('==通过花括号的形式获取scope上的固定属性', function() {
        var fn = parse('aKey["anotherKey"]');
        expect(fn({ aKey: { anotherKey: 42 } })).toBe(42);
    });

    it('----通过花括号的形式获取数值的值', function() {
        var fn = parse('anArray[1]');
        expect(fn({ anArray: [1, 2, 3] })).toBe(2);
    });

    it('----通过花括号的形式查找scope上的动态属性', function() {
        var fn = parse('lock[key]');
        expect(fn({ key: 'theKey', lock: { theKey: 42 } })).toBe(42);
    });

    it('----支持复杂的混合属性获取方式', function() {
        var fn = parse('lock[keys["aKey"]]');
        expect(fn({ keys: { aKey: 'theKey' }, lock: { theKey: 42 } })).toBe(42);
    });

    it('----解析多个[]形式获取属性值', function() {
        var fn = parse('aKey["anotherKey"]["aThirdKey"]');
        expect(fn({ aKey: { anotherKey: { aThirdKey: 42 } } })).toBe(42);
    });

    it('----解析属性后接字段的形式获取属性值', function() {
        var fn = parse('aKey["anotherKey"].aThirdKey');
        expect(fn({ aKey: { anotherKey: { aThirdKey: 42 } } })).toBe(42);
    });

    it('----解析[]和.嵌套形式获取属性值', function() {
        var fn = parse('aKey["anotherKey"].aThirdKey["aFourthKey"]');
        expect(fn({ aKey: { anotherKey: { aThirdKey: { aFourthKey: 42 } } } })).toBe(42);
    });

    it('==解析函数调用', function() {
        var fn = parse('aFunction()');
        expect(fn({
            aFunction: function() {
                return 42;
            }
        })).toBe(42);
    });

    it('----解析带参数的函数调用', function() {
        var fn = parse('aFunction(42)');
        expect(fn({
            aFunction: function(n) {
                return n;
            }
        })).toBe(42);
    });

    it('----解析带参数的函数调用，参数需从scope中获取', function() {
        var fn = parse('aFunction(n)');
        expect(fn({
            n: 42,
            aFunction: function(n) {
                return n;
            }
        })).toBe(42);
    });

    it('----解析带参数的函数调用，参数是一个函数执行结果', function() {
        var fn = parse('aFunction(argFn())');
        expect(fn({
            argFn: _.constant(42),
            aFunction: function(n) {
                return n;
            }
        })).toBe(42);
    });

    it('----解析带参数的函数调用，综合上述三种情况', function() {
        var fn = parse('aFunction(37, n, argFn())');
        expect(fn({
            n: 3,
            argFn: _.constant(2),
            aFunction: function(a1, a2, a3) {
                return a1 + a2 + a3;
            }
        })).toBe(42);
    });

    it('==禁止调用函数的constructor', function() {
        expect(function() {
            var fn = parse('aFunction.constructor("return window;")()');
            fn({ aFunction: function() {} });
        }).toThrow();
    });

    it('----作为对象的一个属性调用函数时正确处理this，以[]的形式', function() {
        var scope = {
            anObject: {
                aMember: 42,
                aFunction: function() {
                    return this.aMember;
                }
            }
        };
        var fn = parse('anObject["aFunction"]()');
        expect(fn(scope)).toBe(42);
    });

    it('----作为字段访问调用函数时正确处理this，以.的形式', function() {
        var scope = {
            anObject: {
                aMember: 42,
                aFunction: function() {
                    return this.aMember;
                }
            }
        };
        var fn = parse('anObject.aFunction()');
        expect(fn(scope)).toBe(42);
    });

    it('----函数名和圆括号之间有空格的调用函数', function() {
        var scope = {
            anObject: {
                aMember: 42,
                aFunction: function() {
                    return this.aMember;
                }
            }
        };
        var fn = parse('anObject.aFunction  ()');
        expect(fn(scope)).toBe(42);
    });

    it('----函数执行时清除this上下文', function() {
        var scope = {
            anObject: {
                aMember: 42,
                aFunction: function() {
                    return function() {
                        return this.aMember;
                    };
                }
            }
        };
        var fn = parse('anObject.aFunction()()');
        expect(fn(scope)).toBeUndefined();
    });

    it('==安全策略2：不允许把window作为属性', function() {
        var fn = parse('anObject["wnd"]');
        expect(function() { fn({ anObject: { wnd: window } }); }).toThrow();
    });

    it('----安全策略2：不允许调用window上的函数', function() {
        var fn = parse('wnd.scroll(500, 0)');
        expect(function() { fn({ wnd: window }); }).toThrow();
    });

    it('----安全策略2：不允许函数返回window对象', function() {
        var fn = parse('getWnd()');
        expect(function() { fn({ getWnd: _.constant(window) }); }).toThrow();
    });

    it('----安全策略2：不允许调用DOM elements上的函数', function() {
        var fn = parse('el.setAttribute("evil", true)');
        expect(function() { fn({ el: document.documentElement }); }).toThrow();
    });

    it('----安全策略2：不允许调用函数的constructor', function() {
        var fn = parse('fnConstructor("return window;")');
        expect(function() { fn({ fnConstructor: (function A() { }).constructor }); }).toThrow();
    });

    // describe('寻找表达式和函数调用表达式', function(){
    //     var scope;
    //     beforeEach(function() {
    //         scope = new Scope();
    //     });

    //     it('从scope上找到一个属性', function(){
    //         var fn = parse('aKey');
    //         expect(fn({aKey: 42})).toBe(42);
    //         expect(fn({})).toBeUndefined();
    //         expect(fn()).toBeUndefined();
    //     });
    // });
});