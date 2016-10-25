/* jshint globalstrict: true */
'use strict';

function initWatchVal() {}

function Scope() {
    this.$$watchers = [];
    this.$$lastDirtyWatch = null;
    this.$$asyncQueue = []; // evalAsync异步队列
    this.$$postDigestQueue = []; // postDigest异步队里
    this.$$root = this; // 根作用域，子作用域通过原型链委托可访问到这个
    this.$$children = []; // 当前作用域的子作用域
    this.$$phase = null;

    this.$$listeners = {}; // $on注册的事件队列
}

Scope.prototype = {

    /**
     * 创建子作用域
     * @param  {boolean}   isolated 是否创建独立作用域
     */
    $new: function(isolated) {

        // 把this(Scope的原型)和对象child关联起来
        // 实现所谓的继承
        var child = isolated ? new Scope() : Object.create(this);

        // 把真实的根作用域给每一个独立作用域的$$root
        if (isolated) {
            child.$$root = this.$$root;

            // 使$evalAsync和$$postDigest执行时直接可以从根作用域执行digest
            child.$$asyncQueue = this.$$asyncQueue;
            child.$$postDigestQueue = this.$$postDigestQueue;

        }

        this.$$children.push(child); // 把子作用域添加到父作用域的children中
        child.$$watchers = [];
        child.$$listeners = {};
        child.$$children = [];
        child.$parent = this;
        return child;
    },

    // 对子作用域执行递归digest
    $$everyScope: function(fn) {
        if (fn(this)) {
            return this.$$children.every(function(child) {
                return child.$$everyScope(fn);
            });
        } else {
            return false;
        }
    },

    /**
     * 监听一个表达式，执行监听函数
     * @param  {[type]}   watchFn    监听的值
     * @param  {function}   listenerFn 值发生改变后执行的函数
     * @param {boolean} valueEq 检测值是否相等，而不是引用，对于Object和Array会检测每一项值是否相等
     */
    $watch: function(watchFn, listenerFn, valueEq) {
        var self = this;
        var watcher = {
            watchFn: watchFn,

            // watcher可以不带listener，为了防止$digest报错，默认给个空函数
            listenerFn: listenerFn || function noop() {},

            valueEq: !!valueEq,

            // 初始化watch的默认值为fn，防止watchFn返回的是一个undefined导致不执行listenerFn
            last: initWatchVal
        };

        // 每次添加watch时，把watcher放到$$watchers的首位，不用push()方法
        this.$$watchers.unshift(watcher);

        // 每次有新加入watch时，把最后一次有脏值的watch置为空，防止listner里面增加的watch不执行
        this.$$root.$$lastDirtyWatch = null;

        /**
         * 返回一个函数用用来remove一个watch
         * var a = $watch(function(){
         *     return scope.a;
         *     }, function(newVal, oldVal){
         *     });
         * a(); // remove watch a
         */
        return function() {
            var watcherIndex = self.$$watchers.indexOf(watcher);
            if (watcherIndex >= 0) {
                self.$$watchers.splice(watcherIndex, 1);
                self.$$root.$$lastDirtyWatch = null;
            }
        };
    },

    /**
     * 对所有的watchers只执行一次
     */
    $$digestOnce: function() {
        var self = this;

        var dirty; // 是否有改变
        var continueLoop = true;
        this.$$everyScope(function(scope) {
            var newValue;
            var oldValue;

            _.forEachRight(scope.$$watchers, function(watcher) {
                if (watcher) {
                    newValue = watcher.watchFn(scope);
                    oldValue = watcher.last;
                    if (!scope.$$areEqual(newValue, oldValue, watcher.valueEq)) {
                        // 每次有脏值出现，则把watcher赋给$$lastDirtyWatch
                        // 需要在listenerFn执行之前进行赋值操作，原因是listenerFn中可能会执行新的$watch()
                        // 而新的$watch()会把$$lastDirtyWatch赋值为null
                        self.$$root.$$lastDirtyWatch = watcher;

                        // 深度监听，则把克隆数据赋给last，否则把引用赋值给last
                        watcher.last = (watcher.valueEq ? _.cloneDeep(newValue) : newValue);
                        watcher.listenerFn(newValue, (
                            oldValue === initWatchVal ? newValue : oldValue
                        ), scope);
                        dirty = true;
                    } else {
                        // 没有脏值时，判断watcher是否和$$lastDirtyWatch一致
                        // 是则表示所有watcher均不是脏值，可以直接返回，提高效率
                        if (self.$$root.$$lastDirtyWatch === watcher) {

                            continueLoop = false;
                            // lodash支持用false来退出循环
                            return false;
                        }
                    }
                }
            });

            return continueLoop;
        });

        return dirty;
    },

    $digest: function() {
        var ttl = 10; // Time To Live 迭代次数
        var dirty;

        // 每次重新执行digest，把最后一个watch是否发生改变标记为null未改变
        this.$$root.$$lastDirtyWatch = null;
        this.$beginPhase("$digest");
        do {
            // digest中执行延后执行的事件
            while (this.$$asyncQueue.length) {
                var asyncTask = this.$$asyncQueue.shift();
                asyncTask.scope.$eval(asyncTask.expression);
            }

            dirty = this.$$digestOnce();

            // 无脏值且达到ttl时，如果有asyncQueue会持续执行
            if ((dirty || this.$$asyncQueue.length) && !(ttl--)) {
                this.$clearPhase();
                throw "10 digest iterations reached";
            }
        } while (dirty || this.$$asyncQueue.length);
        this.$clearPhase();

        while (this.$$postDigestQueue.length) {
            this.$$postDigestQueue.shift()();
        }
    },

    /**
     * 判断两个值是否相等
     * @param  {[type]}   newValue [description]
     * @param  {[type]}   oldValue [description]
     * @param  {boolean}   valueEq  [description]
     */
    $$areEqual: function(newValue, oldValue, valueEq) {
        if (valueEq) {

            // lodash中的isEqual方法可以自动判断是否相等，angular中是单独写的函数
            return _.isEqual(newValue, oldValue);
        } else {
            return newValue === oldValue ||
                (typeof newValue === 'number' && typeof oldValue === 'number' &&
                    isNaN(newValue) && isNaN(oldValue));
        }
    },

    /**
     * 执行表达式或函数
     * @param  {Function} expr  [description]
     * @param  {[type]}   arg [description]
     * @return {[type]}       [description]
     */
    $eval: function(expr, arg) {

        return expr(this, arg);
    },

    // 添加异步执行队列，延后执行
    $evalAsync: function(expr) {
        var self = this;

        // 未digest且没有异步队列
        if (!self.$$phase && !self.$$asyncQueue.length) {
            setTimeout(function() {
                if (self.$$asyncQueue.length) {
                    self.$$root.$digest(); // 根作用域执行digest
                }
            }, 0);
        }

        this.$$asyncQueue.push({
            scope: this,
            expression: expr
        });
    },

    $apply: function(fn) {
        try {
            this.$beginPhase("$apply");
            return this.$eval(fn);
        } finally {
            this.$clearPhase();
            // finnaly保证了即使上面的函数保错也会执行$digest()
            // this.$digest();
            this.$$root.$digest();
        }
    },

    $beginPhase: function(phase) {
        if (this.$$phase) {
            throw this.$$phase + '正在执行';
        }

        this.$$phase = phase;
    },

    $clearPhase: function() {
        this.$$phase = null;
    },

    /**
     * digest之后执行一段程序
     * @param  {Function} fn [description]
     */
    $$postDigest: function(fn) {
        this.$$postDigestQueue.push(fn);
    },

    // 销毁作用域
    $destroy: function() {
        if (this === this.$root) {
            return;
        }

        // 所有同级作用域
        var siblings = this.$parent.$$children;

        // 所有兄弟作用域
        var indexOfThis = siblings.indexOf(this);
        if (indexOfThis >= 0) {
            siblings.splice(indexOfThis, 1);
        }
    },

    // 监听集，用来监听对象和数组，不过只监听外层变化，不做深层次监听
    $watchCollection: function(watchFn, listenerFn) {
        var self = this;
        var newValue;
        var oldValue;
        var changeCount = 0;
        var oldLength; // 放在internalWatchFn外部，在下次监听时直接获取
        var veryOldValue;
        var trackVeryOldValue = listenerFn.length > 1; // 监听执行函数参数个数超过1则表示需要用到oldValue
        var firstRun = true;

        var internalWatchFn = function(scope) {
            newValue = watchFn(scope);

            /* 加一层新老值判断，检测是否发生改变
             * 确实有改变则更新changeCount，internalWatchFn的值就发生变化，
             * this.$watch监听的值发生改变则执行internalListenerFn
             */

            // 不能通过newValue !== oldValue的形式，解决NaN的问题
            // string其实也是类数组，但这里直接过滤掉，string是不可变的所以用此形式监听没用
            if (isObject(newValue)) {
                if (isArrayLike(newValue)) {
                    if (!_.isArray(oldValue)) {
                        // 新老不一致果断发生了改变
                        changeCount++;

                        // 这就导致无论newValue是数组还是类数组，oldValue永远是数组
                        oldValue = [];
                    }

                    // 由于watchCollection是引用比较，
                    // 这里增加监听数组长度的改变，但是同一个数组中某项值发生变化则不视为发生变化
                    if (newValue.length !== oldValue.length) {
                        changeCount++;
                        oldValue.length = newValue.length;
                    }

                    // 监听数组值是否发生改变
                    _.forEach(newValue, function(newItem, i) {
                        if (newItem !== oldValue[i]) {
                            changeCount++;
                            oldValue[i] = newItem;
                        }
                    });

                } else {

                    var newLength = 0; // 新对象属性的个数

                    // object 从无到有，发生改变
                    if (!isObject(oldValue) || isArrayLike(oldValue)) {
                        changeCount++;
                        oldValue = {};
                        oldLength = 0;
                    }

                    // 检测对象值是否有改变
                    for (var key in newValue) {

                        // 只检测当前对象自有属性，不检测通过原型链继承来的
                        if (newValue.hasOwnProperty(key)) {

                            newLength++;

                            if (oldValue.hasOwnProperty(key)) {
                                // 修改属性值
                                // oldValue[key] === undefined
                                if (oldValue[key] !== newValue[key]) {
                                    changeCount++;
                                    oldValue[key] = newValue[key];
                                }
                            } else {
                                // 新增属性
                                changeCount++;

                                // 对于第一次执行来说，这个就是oldObj的属性个数，应该和newLength相等
                                oldLength++;
                                oldValue[key] = newValue[key];
                            }

                        }

                    }

                    // 所以只有删除了对象的属性才会执行二次遍历
                    if (oldLength > newLength) {
                        changeCount++;
                        for (key in oldValue) {
                            if (oldValue.hasOwnProperty(key) && !newValue.hasOwnProperty(key)) {
                                // 删除了属性
                                oldLength--;
                                delete oldValue[key];
                            }
                        }
                    }

                }
            } else {
                // false表示只进行引用比较
                if (!self.$$areEqual(newValue, oldValue, false)) {
                    changeCount++;
                }

                // 普通类型则赋值
                oldValue = newValue;
            }

            return changeCount; // 发生改变的次数，有变化则执行listenerFn
        };

        var internalListenerFn = function() {
            // TODO 显然还有bug，第一次执行时，veryOldValue = oldValue = newValue;

            if (firstRun) {
                listenerFn(newValue, oldValue, self);
                firstRun = false;
            } else {
                listenerFn(newValue, veryOldValue, self);
            }

            if (trackVeryOldValue) {
                // 保留真实的变化之前的值
                veryOldValue = _.clone(newValue);
            }
        };
        return this.$watch(internalWatchFn, internalListenerFn);
    }, // end $watchCollection

    $on: function(eventName, listener) {
        // $$listeners = {eventName:[lis1,lis2]}
        var listeners = this.$$listeners[eventName];
        if (!listeners) {
            // 尚未注册过该事件
            this.$$listeners[eventName] = listeners = [];
        }

        listeners.push(listener);

        // 返回一个操作用于销毁事件
        // 这里的销毁只是销毁当前注入的事件，同名的并不会都被销毁
        return function() {
            var index = listeners.indexOf(listener);
            if (index >= 0) {
                // TODO 如果在执行listener时销毁了当前事件，则会导致临近的下一个注入事件被跳过了
                // listeners.splice(index, 1);
                listeners[index] = null;
            }
        }

    }, // end $on

    /**
     * 朝父级scope发送事件
     * @param  {string}   eventName 事件名称
     * @param  {}   args      额外需要传入的参数
     */
    $emit: function(eventName, args) {
        // 初期其实可以直接把arguments传进去，
        // 但是后期会对第一个参数做处理
        // 巧妙把arguments转成了数组
        
        var evt = {
            name: eventName
        };
        var listenerArgs = [evt].concat([].slice.call(arguments, 1));

        var scope = this;
        do{
            scope.$$fireEventOnScope(eventName, listenerArgs);
            scope = scope.$parent;
        } while(scope)
        // return this.$$fireEventOnScope(eventName, [].slice.call(arguments, 1));
        
        return evt;
    },

    $broadcast: function(eventName, args) {
        var evt = {
            name: eventName
        };
        var listenerArgs = [evt].concat([].slice.call(arguments, 1));

        this.$$everyScope(function(scope){
            scope.$$fireEventOnScope(eventName, listenerArgs);
            return true;
        });
        return evt;
    },

    $$fireEventOnScope: function(eventName, args) {
       
        var listeners = this.$$listeners[eventName] || [];
        
        var i = 0;
        while (i < listeners.length) {
            // 第二次执行时把已销毁的事件干掉
            if (listeners[i] === null) {
                // 不过这里只有二次执行$emit或$braodcast时才会执行
                listeners.splice(i, 1);
            } else {
                listeners[i].apply(null, args);
                i++;
            }
        }

    }
};
