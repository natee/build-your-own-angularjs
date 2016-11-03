/* jshint globalstrict: true */
/* global Scope: false */
'use strict';
describe('Scope', function() {
    it('1.可以作为一个对象被构造和使用', function() {
        var scope = new Scope();
        scope.aProperty = 1;

        expect(scope.aProperty).toBe(1);
    });


    // 第一部分，作用域和digest
    describe('$digest', function() {
        var scope;
        beforeEach(function() {
            scope = new Scope();
        });

        it('1.1 watch第一次$digest时调用监听函数', function() {
            var watchFn = jasmine.createSpy();
            var listenerFn = jasmine.createSpy();
            scope.$watch(watchFn, listenerFn);

            scope.$digest();

            expect(listenerFn).toHaveBeenCalled();
        });

        it('1.2 把scope当做参数调用watch函数', function() {
            var watchFn = jasmine.createSpy();
            var listenerFn = function() {

            };
            scope.$watch(watchFn, listenerFn);
            scope.$digest();
            expect(watchFn).toHaveBeenCalledWith(scope);
        });

        it('1.3 当值发生变化时调用listenerFn', function() {
            scope.someValue = 'a';
            scope.counter = 0;

            scope.$watch(function(scope) {
                return scope.someValue;
            }, function(newValue, oldValue, scope) {
                scope.counter++;
            });

            expect(scope.counter).toBe(0);
            scope.$digest();
            expect(scope.counter).toBe(1);

            // scope.someValue的值未改变，所以调用$digest()没什么卵用
            scope.$digest();
            expect(scope.counter).toBe(1);

            // scope.someValue变了，调用$digets()后会执行listenerFn
            scope.someValue = 'b';
            scope.$digest();
            expect(scope.counter).toBe(2);
        });

        it('1.4 初次值为undefined', function() {
            scope.someValue = undefined;
            scope.counter = 0;

            scope.$watch(function(scope) {
                return scope.someValue;
            }, function(newValue, oldValue, scope) {
                scope.counter++;
            });

            expect(scope.counter).toBe(0);
            scope.$digest();
            expect(scope.counter).toBe(1);
        });

        it('1.5 缺省listener的watcher', function() {
            var watchFn = jasmine.createSpy().and.returnValue('something');
            scope.$watch(watchFn);
            scope.$digest();
            expect(watchFn).toHaveBeenCalled();
        });

        it('1.6 当前digest中修改了scope的其他属性值，即watch中修改了另外一个watch的值', function() {
            scope.name = 'zhaoke';

            // 注意这里的注入watchers的顺序，颠倒则会导致这个case通过
            // 实际上不应该依赖顺序，所以需要去调整代码支持
            scope.$watch(function(scope) {
                return scope.nameUpper;
            }, function(newValue, oldValue, scope) {
                if (newValue) {
                    scope.initial = newValue.substring(0, 1) + '.';
                }
            });

            scope.$watch(function(scope) {
                return scope.name;
            }, function(newValue, oldValue, scope) {
                if (newValue) {
                    scope.nameUpper = newValue.toUpperCase();
                }
            });

            scope.$digest();
            expect(scope.initial).toBe('Z.');
        });

        it('1.7 10次迭代后放弃监听', function() {
            scope.counterA = 0;
            scope.counterB = 0;

            scope.$watch(function(scope) {
                return scope.counterA;
            }, function(newValue, oldValue, scope) {
                scope.counterB++;
            });

            scope.$watch(function(scope) {
                return scope.counterB;
            }, function(newValue, oldValue, scope) {
                scope.counterA++;
            });

            expect(function() {
                scope.$digest();
            }).toThrow();
        });

        it('1.8 最后一个watch是干净的时候则终止digest', function() {
            var watchExecutions = 0; // watch执行次数
            scope.array = _.range(10);

            // 创建10个watch
            _.times(10, function(i) {
                scope.$watch(function(scope) {
                    watchExecutions++;
                    return scope.array[i];
                }, function(newValue, oldValue, scope) {

                });
            });

            // 初次执行digest，执行2次脏值检查
            scope.$digest();
            expect(watchExecutions).toBe(20);

            // 修改所有watchers中的一个，
            // 希望尽量减少watch次数，检测到最后一个watch是干净的则停止digest
            scope.array[0] = 4;
            scope.$digest();
            expect(watchExecutions).toBe(31);

        });

        it('1.9 不结束digest，因此新的watch都不执行', function() {
            scope.aValue = 'abc';
            scope.counter = 0;

            scope.$watch(function(scope) {
                return scope.aValue;
            }, function(newValue, oldValue, scope) {

                // 现在这个是不会执行的，原因是外层watch的listener是在执行$digest()后才执行
                // 而执行listener调用了$watch，但是没有执行$digest()
                scope.$watch(function(scope) {
                    return scope.aValue;
                }, function(newValue, oldValue, scope) {
                    scope.counter++;
                });
            });

            scope.$digest();
            expect(scope.counter).toBe(1);
        });

        it('1.10 监听value的改变，而不仅仅是引用', function() {
            scope.aValue = [1, 2, 3];
            scope.counter = 0;

            scope.$watch(function(scope) {
                return scope.aValue;
            }, function(newValue, oldValue, scope) {
                scope.counter++;
            }, true);

            scope.$digest();
            expect(scope.counter).toBe(1);

            scope.aValue.push(4); // watch.last是对aValue的地址引用，会同时修改成[1,2,3,4]，所以监听不到变化
            scope.$digest();

            // 目前watch对于object和array的引用都是地址引用，不是值，所以这里counter还是1
            expect(scope.counter).toBe(2);
            // expect(scope.counter2).toBe(2);
        });

        it('1.11 处理NaN', function() {
            scope.aValue = 0 / 0;
            scope.counter = 0;

            scope.$watch(function(scope) {
                return scope.aValue;
            }, function(newValue, oldValue, scope) {
                scope.counter++;
            });

            scope.$digest();
            expect(scope.counter).toBe(1);
        });

        it('1.12 $eval用法', function() {
            scope.aValue = 42;
            var r = scope.$eval(function(scope) {
                return scope.aValue;
            });

            expect(r).toBe(42);

        });

        it('1.13 $eval第二个参数用法', function() {
            scope.aValue = 42;
            var r = scope.$eval(function(scope, arg) {
                return scope.aValue + arg;
            }, 2);

            expect(r).toBe(44);

        });

        it('1.14 $apply用法，内部调用$digest', function() {
            scope.a = 'someValue';
            scope.counter = 0;
            scope.$watch(function(scope) {
                return scope.a;
            }, function(newValue, oldValue, scope) {
                scope.counter++;
            });

            scope.$digest();
            expect(scope.counter).toBe(1);

            scope.$apply(function() {
                scope.a = 'otherValue';
            });
            expect(scope.counter).toBe(2);
        });

        it('1.15 $evalAsync的用法，在同一周期中延后执行函数', function() {
            // 和$timeout的区别在于，$timeout把控制权交给了浏览器
            // $evalAsync可以更加严格的控制代码执行时间
            scope.a = [1, 2, 3];
            scope.asyncEvaluated = false;
            scope.asyncEvaluatedImmediately = false;

            scope.$watch(function() {
                return scope.a;
            }, function(newValue, oldValue, scope) {
                scope.$evalAsync(function(scope) {
                    scope.asyncEvaluated = true;
                });
                scope.asyncEvaluatedImmediately = scope.asyncEvaluated;
            });

            scope.$digest();
            expect(scope.asyncEvaluated).toBe(true);
            expect(scope.asyncEvaluatedImmediately).toBe(false);
        });

        it("1.16 watch中执行$evalAsync", function() {
            scope.aValue = [1, 2, 3];
            scope.asyncEvaluatedTimes = 0;
            scope.$watch(function(scope) {
                    if (scope.asyncEvaluatedTimes < 2) {

                        scope.$evalAsync(function(scope) {
                            scope.asyncEvaluatedTimes++;
                        });
                    }
                    return scope.aValue;
                },
                function(newValue, oldValue, scope) {});
            scope.$digest();
            expect(scope.asyncEvaluatedTimes).toBe(2);
        });

        it("1.17 终止通过watch添加$evalAsyncs", function() {
            scope.aValue = [1, 2, 3];
            scope.$watch(function(scope) {
                    //这会导致digest()中的while一直执行
                    scope.$evalAsync(function(scope) {});
                    return scope.aValue;
                },
                function(newValue, oldValue, scope) {});
            expect(function() { scope.$digest(); }).toThrow();
        });

        it("1.18 $$phase的值为当前执行digest的时期", function() {
            scope.aValue = [1, 2, 3];
            scope.phaseInWatchFunction = undefined;
            scope.phaseInListenerFunction = undefined;
            scope.phaseInApplyFunction = undefined;

            scope.$watch(function(scope) {
                    scope.phaseInWatchFunction = scope.$$phase;
                    return scope.aValue;
                },
                function(newValue, oldValue, scope) {
                    scope.phaseInListenerFunction = scope.$$phase;
                }
            );

            scope.$apply(function(scope) {
                scope.phaseInApplyFunction = scope.$$phase;
            });
            expect(scope.phaseInWatchFunction).toBe('$digest');
            expect(scope.phaseInListenerFunction).toBe('$digest');
            expect(scope.phaseInApplyFunction).toBe('$apply');
        });

        it('1.19 $evalAsync中来一个digest', function(done) {
            scope.aValue = "abc";
            scope.counter = 0;
            scope.$watch(
                function(scope) {
                    return scope.aValue;
                },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                });

            // $evalAsync中需要一个digest
            scope.$evalAsync(function(scope) {});
            expect(scope.counter).toBe(0);

            // 延时需比$evalAsync中的大，使digest正常执行
            setTimeout(function() {
                expect(scope.counter).toBe(1);
                done();
            }, 1);
        });

        it('1.20 每次digest后执行$$postDigest函数', function() {
            scope.counter = 0;
            scope.$$postDigest(function() {
                scope.counter++;
            });

            expect(scope.counter).toBe(0);

            scope.$digest();
            expect(scope.counter).toBe(1);

            // $$postDigest队列已经执行过，$$postDigestQueue为空，所以不会再次执行
            scope.$digest();
            expect(scope.counter).toBe(1);
        });

        it('1.21 digest中不包含$postDigest', function() {
            scope.a = 'a';

            scope.$$postDigest(function() {
                scope.a = 'b';

            });

            scope.$watch(function(scope) {
                return scope.a;
            }, function(newValue, oldValue, scope) {
                scope.watchVal = newValue;
            });

            scope.$digest();
            expect(scope.watchVal).toBe('a');

            scope.$digest();
            expect(scope.watchVal).toBe('b');

        });

        it("1.22 销毁$watch", function() {
            scope.aValue = 'abc';
            scope.counter = 0;
            var destroyWatch = scope.$watch(function(scope) {
                return scope.aValue;
            }, function(newValue, oldValue, scope) {
                scope.counter++;
            });
            scope.$digest();
            expect(scope.counter).toBe(1);
            scope.aValue = 'def';
            scope.$digest();
            expect(scope.counter).toBe(2);
            scope.aValue = 'ghi';
            destroyWatch();
            scope.$digest();
            expect(scope.counter).toBe(2);
        });

        it("1.23 在digest期间destory了一个$watch", function() {
            scope.aValue = 'abc';
            var watchCalls = [];

            scope.$watch(function(scope) {
                watchCalls.push('first');
                return scope.aValue;
            });

            var destroyWatch = scope.$watch(function(scope) {
                watchCalls.push('second');

                // 销毁watch后需要重新进行脏值检测
                destroyWatch();
            });

            scope.$watch(function(scope) {
                watchCalls.push('third');
                return scope.aValue;
            });

            // $$watchers = ['first','second','third']
            // 中途销毁一个watch，导致$$digestOnce序列错乱，无法执行后面的watch

            scope.$digest();
            expect(watchCalls).toEqual(['first', 'second', 'third', 'first', 'third']);
        });
    }); // end describe

    // 第二部分，inheritance，作用域继承
    describe('inheritance', function() {
        it('2.1继承父级属性', function() {
            var parent = new Scope();
            parent.aValue = [1, 2, 3];
            var child = parent.$new();
            expect(child.aValue).toEqual([1, 2, 3]);
        });

        it('2.2 父级拿不到子级的属性', function() {
            var parent = new Scope();
            var child = parent.$new();
            child.aValue = [1, 2, 3];

            expect(parent.aValue).toBeUndefined();
        });

        it('2.3 继承父级的属性应该与定义父级属性的时间无关', function() {
            var parent = new Scope();
            var child = parent.$new();
            parent.aValue = [1, 2, 3];

            expect(child.aValue).toEqual([1, 2, 3]);
        });

        it('2.4 可修改父作用域的属性', function() {
            var parent = new Scope();
            var child = parent.$new();
            parent.aValue = [1, 2, 3];
            child.aValue.push(4);

            expect(child.aValue).toEqual([1, 2, 3, 4]);
            expect(parent.aValue).toEqual([1, 2, 3, 4]);
        });

        it("2.5 watch父作用域中的熟悉", function() {
            var parent = new Scope();
            var child = parent.$new();
            parent.aValue = [1, 2, 3];
            child.counter = 0;
            child.$watch(
                function(scope) {
                    return scope.aValue;
                },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                },
                true
            );
            child.$digest();
            expect(child.counter).toBe(1);
            parent.aValue.push(4);
            child.$digest();
            expect(child.counter).toBe(2);
        });

        it("2.6 可以嵌套任意深的层级", function() {
            var a = new Scope();
            var aa = a.$new();
            var aaa = aa.$new();
            var aab = aa.$new();
            var ab = a.$new();
            var abb = ab.$new();
            a.value = 1;
            expect(aa.value).toBe(1);
            expect(aaa.value).toBe(1);
            expect(aab.value).toBe(1);
            expect(ab.value).toBe(1);
            expect(abb.value).toBe(1);

            ab.anotherValue = 2;
            expect(abb.anotherValue).toBe(2);
            expect(aa.anotherValue).toBeUndefined();
            expect(aaa.anotherValue).toBeUndefined();
        });

        it("2.7 用同名属性覆盖父作用域属性", function() {
            var parent = new Scope();
            var child = parent.$new();
            parent.name = 'Joe';
            child.name = 'Jill';
            expect(child.name).toBe('Jill');
            expect(parent.name).toBe('Joe');
        });

        it("2.8 子作用域更改父作用域的属性", function() {
            var parent = new Scope();
            var child = parent.$new();
            parent.user = { name: 'Joe' };
            child.user.name = 'Jill';
            expect(child.user.name).toBe('Jill');
            expect(parent.user.name).toBe('Jill');
        });

        it("2.9 执行digest时不执行父级的watch", function() {
            var parent = new Scope();
            var child = parent.$new();
            parent.aValue = 'abc';
            parent.$watch(
                function(scope) {
                    return scope.aValue;
                },
                function(newValue, oldValue, scope) {
                    scope.aValueWas = newValue;
                }
            );
            child.$digest();
            expect(child.aValueWas).toBeUndefined();
        });

        it("2.10 记录子作用域", function() {
            var parent = new Scope();
            var child1 = parent.$new();
            var child2 = parent.$new();
            var child2_1 = child2.$new();
            expect(parent.$$children.length).toBe(2);
            expect(parent.$$children[0]).toBe(child1);
            expect(parent.$$children[1]).toBe(child2);
            expect(child1.$$children.length).toBe(0);
            expect(child2.$$children.length).toBe(1);
            expect(child2.$$children[0]).toBe(child2_1);
        });

        it("2.11 父级作用域执行digest触发子作用域的watch", function() {
            var parent = new Scope();
            var child = parent.$new();
            parent.aValue = 'abc';
            child.$watch(function(scope) {
                return scope.aValue;
            }, function(newValue, oldValue, scope) {
                scope.aValueWas = newValue;
            });

            parent.$digest();
            expect(child.aValueWas).toBe('abc');
        });

        // 正常的digest只会父影响子
        it("2.12 执行$apply时进行全局digest", function() {
            var parent = new Scope();
            var child = parent.$new();
            var child2 = child.$new();
            parent.aValue = 'abc';
            parent.counter = 0;
            parent.$watch(
                function(scope) {
                    return scope.aValue;
                },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                }
            );
            child2.$apply(function(scope) {});
            expect(parent.counter).toBe(1);
        });

        it("2.13 执行$evalAsync时进行全局digest", function(done) {
            var parent = new Scope();
            var child = parent.$new();
            var child2 = child.$new();
            parent.aValue = 'abc';
            parent.counter = 0;
            parent.$watch(
                function(scope) {
                    return scope.aValue;
                },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                }
            );

            child2.$evalAsync(function(scope) {});
            setTimeout(function() {
                expect(parent.counter).toBe(1);
                done();
            }, 50);
        });

        it("2.14 独立作用域不可以访问父级属性", function() {
            var parent = new Scope();
            var child = parent.$new(true);
            parent.aValue = 'abc';
            expect(child.aValue).toBeUndefined();
        });

        it("2.15 独立作用域不可以监听父作用域属性", function() {
            var parent = new Scope();
            var child = parent.$new(true);
            parent.aValue = 'abc';
            child.$watch(
                function(scope) {
                    return scope.aValue; // undefined
                },
                function(newValue, oldValue, scope) {
                    scope.aValueWas = newValue;
                }
            );
            child.$digest();
            expect(child.aValueWas).toBeUndefined();
        });

        it("2.16 父作用域执行digest时应该影响独立子作用域", function() {
            var parent = new Scope();
            var child = parent.$new(true);
            child.aValue = 'abc';
            child.$watch(
                function(scope) {
                    return scope.aValue;
                },
                function(newValue, oldValue, scope) {
                    scope.aValueWas = newValue;
                }
            );
            parent.$digest();
            expect(child.aValueWas).toBe('abc');
        });

        it("2.17 独立子作用域执行$apply时从根作用域开始digest", function() {
            var parent = new Scope();
            var child = parent.$new(true);
            var child2 = child.$new();
            parent.aValue = '2.17';
            parent.counter = 0;
            parent.$watch(
                function(scope) {
                    return scope.aValue;
                },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                }
            );
            child2.$apply(function(scope) {});
            expect(parent.counter).toBe(1);
        });

        it("2.18 独立子作用域执行$evalAsync时从根作用域开始digest", function(done) {
            var parent = new Scope();
            var child = parent.$new(true);
            var child2 = child.$new();
            parent.aValue = '2.18';
            parent.counter = 0;
            parent.$watch(
                function(scope) {
                    return scope.aValue;
                },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                }
            );
            child2.$evalAsync(function(scope) {});
            setTimeout(function() {
                expect(parent.counter).toBe(1);
                done();
            }, 50);
        });

        it("2.19 在独立作用域中执行$evalAsync", function(done) {
            var parent = new Scope();
            var child = parent.$new(true);

            // $evalAsync中执行digest的是self.$$root，
            // 所以$digest中的$$asyncQueue是rootScope.$$asyncQueue
            // 应该把父作用域的$$asyncQueue引用赋给child
            child.$evalAsync(function(scope) {
                scope.didEvalAsync = true;
            });

            setTimeout(function() {
                expect(child.didEvalAsync).toBe(true);
                done();
            }, 500);
        });

        it("2.20 在独立作用域中执行$$postDigest", function() {
            var parent = new Scope();
            var child = parent.$new(true);
            child.$$postDigest(function() {
                child.didPostDigest = true;
            });

            // 此时parent.$digest中this.$$postDigest为空
            // 所以需要修改源代码把父作用域的$$postDigest和子作用域的$$postDigest关联起来
            parent.$digest();
            expect(child.didPostDigest).toBe(true);
        });

        it("2.21 调用$destory后将不会再被digest", function() {
            var parent = new Scope();
            var child = parent.$new();
            child.aValue = [1, 2, 3];
            child.counter = 0;
            child.$watch(
                function(scope) {
                    return scope.aValue;
                },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                },
                true
            );
            parent.$digest();
            expect(child.counter).toBe(1);
            child.aValue.push(4);
            parent.$digest();
            expect(child.counter).toBe(2);
            child.$destroy();
            child.aValue.push(5);
            parent.$digest();
            expect(child.counter).toBe(2);
        });
    }); // end describe

    // 第三部分，watchCollection，监听集
    describe("$watchCollection", function() {
        var scope;
        beforeEach(function() {
            scope = new Scope();
        });

        it("3.1 对于non-collections来说就像普通watch一样", function() {
            var valueProvided;
            scope.aValue = 42;
            scope.counter = 0;
            scope.$watchCollection(
                function(scope) {
                    return scope.aValue;
                },
                function(newValue, oldValue, scope) {
                    valueProvided = newValue;
                    scope.counter++;
                }
            );
            scope.$digest();
            expect(scope.counter).toBe(1);
            expect(valueProvided).toBe(scope.aValue);
            scope.aValue = 43;
            scope.$digest();
            expect(scope.counter).toBe(2);

            // 再次执行，值没改变，所以不执行watch
            scope.$digest();
            expect(scope.counter).toBe(2);
        });

        it("3.2 监听NaN", function() {
            scope.aValue = 0 / 0;
            scope.counter = 0;
            scope.$watchCollection(
                function(scope) {
                    return scope.aValue;
                },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                }
            );
            scope.$digest();
            expect(scope.counter).toBe(1);
            scope.$digest();
            expect(scope.counter).toBe(1);
        });

        it("3.3 监听新数组", function() {
            scope.counter = 0;
            scope.$watchCollection(
                function(scope) {
                    return scope.arr;
                },
                function(newValue, oldValue, scope) {
                    scope.counter++;
                }
            );
            scope.$digest();
            expect(scope.counter).toBe(1);
            scope.arr = [1, 2, 3];
            scope.$digest();
            expect(scope.counter).toBe(2);
            scope.$digest();
            expect(scope.counter).toBe(2);
        });

        it("3.4 监听数组元素的增加", function() {
            scope.arr = ['a', 'b'];
            scope.counter = 0;

            scope.$watchCollection(function(scope) {
                return scope.arr;
            }, function(newValue, oldValue, scope) {
                scope.counter++;
            });

            scope.$digest();
            expect(scope.counter).toBe(1);

            scope.arr.push(4);
            scope.$digest();
            expect(scope.counter).toBe(2);

            scope.$digest();
            expect(scope.counter).toBe(2);

        });

        it("3.5 监听数组元素的减少", function() {
            scope.arr = ['a', 'c'];
            scope.counter = 0;

            scope.$watchCollection(function(scope) {
                return scope.arr;
            }, function(newValue, oldValue, scope) {
                scope.counter++;
            });

            scope.$digest();
            expect(scope.counter).toBe(1);

            scope.arr.shift();
            scope.$digest();
            expect(scope.counter).toBe(2);

            scope.$digest();
            expect(scope.counter).toBe(2);

        });

        it("3.6 监听数组项的改变", function() {
            scope.arr = ['a', 'c'];
            scope.counter = 0;

            scope.$watchCollection(function(scope) {
                return scope.arr;
            }, function(newValue, oldValue, scope) {
                scope.counter++;
            });

            scope.$digest();
            expect(scope.counter).toBe(1);

            scope.arr[1] = 'd';
            scope.$digest();
            expect(scope.counter).toBe(2);

            scope.$digest();
            expect(scope.counter).toBe(2);

        });

        it("3.7 监听数组项的排序", function() {
            scope.arr = [2, 1, 3];
            scope.counter = 0;

            scope.$watchCollection(function(scope) {
                return scope.arr;
            }, function(newValue, oldValue, scope) {
                scope.counter++;
            });

            scope.$digest();
            expect(scope.counter).toBe(1);

            scope.arr.sort();
            scope.$digest();
            expect(scope.counter).toBe(2);

            scope.$digest();
            expect(scope.counter).toBe(2);

        });

        it("3.8 监听函数参数的改变，类数组的对象", function() {

            // 类数组：参数、DOM中的NodeList
            (function() {
                scope.arrayLike = arguments;
            })(1, 2, 3);
            scope.counter = 0;

            scope.$watchCollection(function(scope) {
                return scope.arrayLike;
            }, function(newValue, oldValue, scope) {
                scope.counter++;
            });

            scope.$digest();
            expect(scope.counter).toBe(1);

            scope.arrayLike[1] = 4;
            scope.$digest();
            expect(scope.counter).toBe(2);

            scope.$digest();
            expect(scope.counter).toBe(2);

        });

        it("3.9 监听NodeList对象的改变，类数组的对象", function() {

            document.documentElement.appendChild(document.createElement('div'));
            scope.arrayLike = document.getElementsByTagName('div');

            scope.counter = 0;

            scope.$watchCollection(function(scope) {
                return scope.arrayLike;
            }, function(newValue, oldValue, scope) {
                scope.counter++;
            });

            scope.$digest();
            expect(scope.counter).toBe(1);

            document.documentElement.appendChild(document.createElement('div'));
            scope.$digest();
            expect(scope.counter).toBe(2);

            scope.$digest();
            expect(scope.counter).toBe(2);

        });

        it("3.10 监听到一个值变成对象", function() {

            scope.counter = 0;

            scope.$watchCollection(function(scope) {
                return scope.obj;
            }, function(newValue, oldValue, scope) {
                scope.counter++;
            });

            scope.$digest();
            expect(scope.counter).toBe(1);

            scope.obj = {
                a: 1
            };
            scope.$digest();
            expect(scope.counter).toBe(2);

            scope.$digest();
            expect(scope.counter).toBe(2);

        });

        it("3.11 对象中新增属性", function() {

            scope.counter = 0;
            scope.obj = {
                a: 1
            };

            scope.$watchCollection(function(scope) {
                return scope.obj;
            }, function(newValue, oldValue, scope) {
                scope.counter++;
            });

            scope.$digest();
            expect(scope.counter).toBe(1);

            scope.obj.b = 2;
            scope.$digest();
            expect(scope.counter).toBe(2);

        });

        it("3.12 对象中属性的值发生改变", function() {

            scope.counter = 0;
            scope.obj = {
                a: 1
            };

            scope.$watchCollection(function(scope) {
                return scope.obj;
            }, function(newValue, oldValue, scope) {
                scope.counter++;
            });

            scope.$digest();
            expect(scope.counter).toBe(1);

            scope.obj.a = 2;
            scope.$digest();
            expect(scope.counter).toBe(2);

        });

        it("3.13 删除对象的属性", function() {

            scope.counter = 0;
            scope.obj = {
                a: 1
            };

            scope.$watchCollection(function(scope) {
                return scope.obj;
            }, function(newValue, oldValue, scope) {
                scope.counter++;
            });

            scope.$digest();
            expect(scope.counter).toBe(1);

            delete scope.obj.a;
            scope.$digest();
            expect(scope.counter).toBe(2);

        });

        it("3.14 特殊case:对象带有一个length的属性", function() {

            scope.counter = 0;
            scope.obj = {
                a: 1,
                length: 5
            };

            scope.$watchCollection(function(scope) {
                return scope.obj;
            }, function(newValue, oldValue, scope) {
                scope.counter++;
            });

            scope.$digest();
            expect(scope.counter).toBe(1);

            scope.obj.newKey = 2; // 新增项，但是obj.length未改变
            scope.$digest();
            expect(scope.counter).toBe(2);

        });

        it("3.15 特殊case:对象带有一个length的属性", function() {

            scope.aValue = { a: 1, b: 2 };
            var oldValueGiven;

            scope.$watchCollection(function(scope) {
                return scope.aValue;
            }, function(newValue, oldValue, scope) {
                oldValueGiven = oldValue;
            });

            // scope.$digest();
            // expect(oldValueGiven).toBeUndefined();
            // scope.aValue.c = 3;
            scope.$digest();
            expect(oldValueGiven).toEqual({ a: 1, b: 2 });

        });
    }); // end describe

    // 第四部分，作用域事件
    describe("Events", function() {

        var parent;
        var scope;
        var child;
        var isolatedChild;

        beforeEach(function() {
            parent = new Scope();
            scope = parent.$new();
            child = scope.$new();
            isolatedChild = scope.$new(true);
        });

        it("4.1 注册事件", function() {
            var lis1 = function() {};
            var lis2 = function() {};
            var lis3 = function() {};
            scope.$on('someEvent', lis1);
            scope.$on('someEvent', lis2);
            scope.$on('someOtherEvent', lis3);

            expect(scope.$$listeners).toEqual({
                someEvent: [lis1, lis2],
                someOtherEvent: [lis3]
            });
        });

        it("4.1 给不同的作用域注册不同事件", function() {
            var lis1 = function() {};
            var lis2 = function() {};
            var lis3 = function() {};
            scope.$on('someEvent', lis1);
            child.$on('someEvent', lis2);
            isolatedChild.$on('someOtherEvent', lis3);

            expect(scope.$$listeners).toEqual({
                someEvent: [lis1]
            });

            expect(child.$$listeners).toEqual({
                someEvent: [lis2]
            });

            expect(isolatedChild.$$listeners).toEqual({
                someOtherEvent: [lis3]
            });
        });

        _.forEach(['$emit', '$broadcast'], function(method) {
            it("4.2 通过" + method + "调用相应的listener", function() {
                var lis1 = jasmine.createSpy();
                var lis2 = jasmine.createSpy();
                var lis3 = jasmine.createSpy();
                scope.$on('someEvent', lis1);
                scope.$on('someEvent', lis2);
                scope.$on('someOtherEvent', lis3);

                scope[method]('someEvent');
                expect(lis1).toHaveBeenCalled();
                expect(lis2).toHaveBeenCalled();
            });

            it("4.3 把一个带有name的event对象传递给" + method + "中的listener作为参数，", function() {
                var lis1 = jasmine.createSpy();
                scope.$on('someEvent', lis1);

                scope[method]('someEvent');
                expect(lis1).toHaveBeenCalled();
                expect(lis1.calls.mostRecent().args[0].name).toEqual('someEvent');
            });

            it("4.4 把相同的event对象传递给" + method + "中的每一个listener，", function() {
                var lis1 = jasmine.createSpy();
                var lis2 = jasmine.createSpy();
                scope.$on('someEvent', lis1);
                scope.$on('someEvent', lis2);

                scope[method]('someEvent');

                var event1 = lis1.calls.mostRecent().args[0];
                var event2 = lis2.calls.mostRecent().args[0];

                expect(event1).toBe(event2);
            });

            it("4.5 传递额外的参数给" + method + "中的listener，", function() {
                var lis1 = jasmine.createSpy();
                scope.$on('someEvent', lis1);

                scope[method]('someEvent', 'and', ['additional', 'arguments'], '...');

                var args = lis1.calls.mostRecent().args;

                // expect(args[0]).toEqual({ name: 'someEvent' });
                expect(args[1]).toEqual('and');
                expect(args[2]).toEqual(['additional', 'arguments']);
            });

            it("4.6 " + method + "返回event对象", function() {
                var returnedEvent = scope[method]('someEvent');
                expect(returnedEvent).toBeDefined();
                expect(returnedEvent.name).toEqual('someEvent');
            });

            it("4.7 销毁" + method + "事件", function() {
                var listener = jasmine.createSpy();
                var deregister = scope.$on('someEvent', listener);
                deregister();
                scope[method]('someEvent');
                expect(listener).not.toHaveBeenCalled();
            });

            it("4.8 特殊case：在" + method + "的listener中销毁了事件", function() {
                var deregister;
                var listener = function() {
                    deregister();
                };
                var nextListener = jasmine.createSpy();
                deregister = scope.$on('someEvent', listener);
                scope.$on('someEvent', nextListener);
                scope[method]('someEvent');
                expect(nextListener).toHaveBeenCalled();
            });


            it("4.9 $emit向上传播", function() {
                var parentListener = jasmine.createSpy();
                var scopeListener = jasmine.createSpy();

                parent.$on('someEvent', parentListener);
                scope.$on('someEvent', scopeListener);

                scope.$emit('someEvent');

                expect(scopeListener).toHaveBeenCalled();
                expect(parentListener).toHaveBeenCalled();
            });

            it("4.10 $broadcast向下传播", function() {
                var scopeListener = jasmine.createSpy();
                var childListener = jasmine.createSpy();
                var isolatedChildListener = jasmine.createSpy();

                scope.$on('someEvent', scopeListener);
                child.$on('someEvent', childListener);
                isolatedChild.$on('someEvent', isolatedChildListener);

                scope.$broadcast('someEvent');

                expect(scopeListener).toHaveBeenCalled();
                expect(childListener).toHaveBeenCalled();
                expect(isolatedChildListener).toHaveBeenCalled();
            });

            it("4.15 在" + method + "上调用了preventDefault后设置defaultPrevented", function() {
                var listener = function(event) {
                    event.preventDefault();
                };
                scope.$on('someEvent', listener);
                var event = scope[method]('someEvent');
                expect(event.defaultPrevented).toBe(true);
            });

            it("4.18 " + method + "上发生异常也不会停止程序", function() {
                var listener1 = function(event) {
                    throw 'listener1 throwing an exception';
                };
                var listener2 = jasmine.createSpy();
                scope.$on('someEvent', listener1);
                scope.$on('someEvent', listener2);
                scope[method]('someEvent');
                expect(listener2).toHaveBeenCalled();
            });

        });


        it("4.11 添加targetScope到$emit上", function() {
            var scopeListener = jasmine.createSpy();
            var parentListener = jasmine.createSpy();
            scope.$on('someEvent', scopeListener);
            parent.$on('someEvent', parentListener);
            scope.$emit('someEvent');
            expect(scopeListener.calls.mostRecent().args[0].targetScope).toBe(scope);
            expect(parentListener.calls.mostRecent().args[0].targetScope).toBe(scope);
        });

        it("4.12 添加currentScope到$emit上", function() {
            var currentScopeOnScope, currentScopeOnParent;
            var scopeListener = function(event) {
                currentScopeOnScope = event.currentScope;
            };
            var parentListener = function(event) {
                currentScopeOnParent = event.currentScope;
            };
            scope.$on('someEvent', scopeListener);
            parent.$on('someEvent', parentListener);
            scope.$emit('someEvent');
            expect(currentScopeOnScope).toBe(scope);
            expect(currentScopeOnParent).toBe(parent);
        });

        it("4.13 阻止执行父级scope的事件", function() {
            var scopeListener = function(event) {
                event.stopPropagation();
            };
            var parentListener = jasmine.createSpy();
            scope.$on('someEvent', scopeListener);
            parent.$on('someEvent', parentListener);
            scope.$emit('someEvent');
            expect(parentListener).not.toHaveBeenCalled();
        });

        it("4.14 阻止冒泡后仍然需要执行当前作用域事件队列中的其他listener", function() {
            var listener1 = function(event) {
                event.stopPropagation();
            };
            var listener2 = jasmine.createSpy();
            scope.$on('someEvent', listener1);
            scope.$on('someEvent', listener2);
            scope.$emit('someEvent');
            expect(listener2).toHaveBeenCalled();
        });

        it("4.16 销毁后触发$destroy", function() {
            var listener = jasmine.createSpy();
            scope.$on('$destroy', listener);
            scope.$destroy();
            expect(listener).toHaveBeenCalled();
        });

        it("4.17 children销毁时触发$destroy", function() {
            var listener = jasmine.createSpy();
            child.$on('$destroy', listener);
            scope.$destroy();
            expect(listener).toHaveBeenCalled();
        });

    }); // end describe
});
