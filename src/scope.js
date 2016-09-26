/* jshint globalstrict: true */
'use strict';

function initWatchVal() {}

function Scope() {
    this.$$watchers = [];
    this.$$lastDirtyWatch = null;
    this.$$asyncQueue = []; // evalAsync异步队列
    this.$$postDigestQueue = []; // postDigest异步队里
    this.$$phase = null;
}

Scope.prototype = {

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
        this.$$watchers.unshift(watcher);

        // 每次有新加入watch时，把最后一次有脏值的watch置为空，防止listner里面增加的watch不执行
        this.$$lastDirtyWatch = null;

        return function(){
        	var watcherIndex = self.$$watchers.indexOf(watcher);
        	if(watcherIndex >= 0){
        		self.$$watchers.splice(watcherIndex, 1);
        		self.$$lastDirtyWatch = null;
        	}
        }
    },

    /**
     * 对所有的watchers只执行一次
     */
    $$digestOnce: function() {
        var self = this;
        var newValue;
        var oldValue;
        var dirty; // 是否有改变

        _.forEachRight(this.$$watchers, function(watcher) {
        	if(watcher){
	            newValue = watcher.watchFn(self);
	            oldValue = watcher.last;
	            if (!self.$$areEqual(newValue, oldValue, watcher.valueEq)) {
	                // 每次有脏值出现，则把watcher赋给$$lastDirtyWatch
	                // 需要在listenerFn执行之前进行赋值操作，原因是listenerFn中可能会执行新的$watch()
	                // 而新的$watch()会把$$lastDirtyWatch赋值为null
	                self.$$lastDirtyWatch = watcher;

	                // 深度监听，则把克隆数据赋给last，否则把引用赋值给last
	                watcher.last = (watcher.valueEq ? _.cloneDeep(newValue) : newValue);
	                watcher.listenerFn(newValue, (
	                    oldValue === initWatchVal ? newValue : oldValue
	                ), self);
	                dirty = true;
	            } else {
	                // 没有脏值时，判断watcher是否和$$lastDirtyWatch一致
	                // 是则表示所有watcher均不是脏值，可以直接返回，提高效率
	                if (self.$$lastDirtyWatch === watcher) {

	                    // lodash支持用false来退出循环
	                    return false;
	                }
	            }
            }
        });

        return dirty;
    },

    $digest: function() {
        var ttl = 10; // Time To Live 迭代次数
        var dirty;

        // 每次重新执行digest，把最后一个watch是否发生改变标记为null未改变
        this.$$lastDirtyWatch = null;
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
                    self.$digest();
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
            // finnaly保证了及时上门的函数保错也会执行$digest()
            this.$digest();
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
    }
};
