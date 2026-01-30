import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PatternfinderService {

  constructor() { }

  public getThreadingFromArr(arr) {
    var marked_strings: number[][] = [];
    var marked_strings_frame_tracker: number[] = [];
    var threading: number[][] = [];
    for (var i = 0; i < arr.length; i++) {
        threading.push([]);
        for (var j = 0; j < arr[i].length; j++) {
            threading[i].push(0);
        }
    }
    var frame_count: number = 0;

    for (var c = 0; c < arr.length; c++) {
        if (!marked_strings.includes(arr[c])) {
            marked_strings.push(arr[c]);
            marked_strings_frame_tracker.push(frame_count);
            threading[frame_count][c] = 1;
            frame_count += 1;
        } else {
            for (var s = 0; s < marked_strings.length; s++) {
                if (marked_strings[s] == arr[c]) {
                    threading[marked_strings_frame_tracker[s]][c] = 1;
                }
            }
        }
    }

    var max_idx = 0;
    for (var i = threading.length-1; i >= 0; i--) {
        if (threading[i].find(elmt => elmt == 1)) {
            for (var j = 0; j < threading[i].length; j++) {
                if (threading[i][j] == 0) {
                    var allZero: boolean = true;
                    for (var k = j+1; k < threading[i].length; k++) {
                        if (threading[i][k] == 1) {
                            allZero = false;
                        }
                    }
                    if (allZero && max_idx < j) {
                        max_idx = j;
                    }
                }
            }
        } else {
            threading.splice(i, 1);
        }
    }

    for (var i = 0; i < threading.length; i++) {
        threading[i].splice(max_idx+1, threading[i].length-max_idx+1);
    }
    var toRetThreading: number[] = [];
    for (var i = 0; i < threading.length; i++) {
        for (var j = 0; j < threading[i].length; j++) {
            if (threading[i][j] == 1) {
                toRetThreading.push(j);
                break;
            }
        }
    }
    return toRetThreading;
}

public getTreadlingFromArr(arr) {
    var marked_strings: number[][] = [];
    var marked_strings_col_tracker: number[] = [];
    var treadling: number[][] = [];
    for (var i = 0; i < arr.length; i++) {
        treadling.push([]);
        for (var j = 0; j < arr[i].length; j++) {
            treadling[i].push(0);
        }
    }
    var treadle_count: number = 0;

    for (var r = 0; r < arr.length; r++) {
        if (!marked_strings.includes(arr[r])) {
            marked_strings.push(arr[r]);
            marked_strings_col_tracker.push(treadle_count);
            treadling[r][treadle_count] = 1;
            treadle_count += 1;
        } else {
            for (var s = 0; s < marked_strings.length; s++) {
                if (marked_strings[s] == arr[r]) {
                    treadling[r][marked_strings_col_tracker[s]] = 1;
                }
            }
        }
    }

    var max_idx = 0;
    for (var i = treadling.length-1; i >= 0; i--) {
        if (treadling[i].find(elmt => elmt == 1)) {
            for (var j = 0; j < treadling[i].length; j++) {
                if (treadling[i][j] == 0) {
                    var allZero: boolean = true;
                    for (var k = j+1; k < treadling[i].length; k++) {
                        if (treadling[i][k] == 1) {
                            allZero = false;
                        }
                    }
                    if (allZero && max_idx < j) {
                        max_idx = j;
                    }
                }
            }
        } else {
            treadling.splice(i, 1);
        }
    }

    for (var i = 0; i < treadling.length; i++) {
        treadling[i].splice(max_idx+1, treadling[i].length-max_idx+1);
    }
    var toRetTreadling: number[] = [];
    for (var i = 0; i < treadling.length; i++) {
        for (var j = 0; j < treadling[i].length; j++) {
            if (treadling[i][j] == 1) {
                toRetTreadling.push(j);
                break;
            }
        }
    }
    return toRetTreadling;
}

private findBasePatternString(subsection: string) {
    var str: string = "";
    var pattern: any = [];
    for (var i = 0; i < subsection.length; i++) {
        let currentChar = subsection[i]
        if (currentChar == ",") {
            pattern.push(parseInt(str));
            str = "";
        } else {
            str += currentChar;
        }
    }
    return this.findBasePatternArray(pattern)
}

private findBasePatternArray(pattern: any) {
    for (var i = 2; i < pattern.length; i++) {
        if (pattern.length % i == 0) {
            var match = true;
            for (var j = 1; j < i; j++) {
                if (pattern.slice(0, pattern.length/i) != pattern.slice((pattern.length/i)*j,(pattern.length/i)*(j+1))) {
                    match = false;
                }
                if (match) {
                    return this.findBasePatternArray(pattern.slice(0, pattern.length/i));
                }
            }
        }
    }
    return pattern;
}

private toString(pattern: any) {
    var strPattern: string = "";
    for (var i = 0; i < pattern.length; i++) {
        var num: number = pattern[i];
        strPattern += num.toString();
        strPattern += ",";
    }
    return strPattern.slice(0, -1);
}

private toArray(pattern: string) {
    var arrayPattern: any = [];
    var temp: string = "";
    for (var i = 0; i < pattern.length; i++) {
        var currentChar = pattern[i];
        if (currentChar != ",") {
            temp += currentChar;
            if (i == pattern.length - 1) {
                arrayPattern.push(parseInt(temp));
            }
        } else if (currentChar == ",") {
            arrayPattern.push(parseInt(temp));
            temp = "";
        } 
    }
    return arrayPattern;
}

private countOccurances(arr, item) {
    var count = 0;
    for (var i in arr) {
        if (i == item) {
            count += 1;
        }
    }
    return count;
}

private findPatterns(sequence) {
    for (var i = 0; i < sequence.length; i++) {
        if (sequence[i] == -1) {
            var allEmpty = true;
            for (var j = i+1; j < sequence.length; j++) {
                if (sequence[j] != -1) {
                    allEmpty = false;
                }
            }
            if (allEmpty) {
                break;
            }
        }
    }
    if (allEmpty) {
        sequence.splice(i, sequence.length - i);
    }
    var singles = {};

    for (var i = 0; i < sequence.length; i++) {
        var count = 0;
        sequence.forEach(element => {
            if (element == sequence[i]) {
                count += 1;
            }
        });
        singles[sequence[i]] = count;
    }
    for (var key in singles) {
        if (singles[key] == 1) {
            delete singles[key];
        }
    }
    if (Object.keys(singles).length == 0) {
        return sequence;
    }
    
    for (var size = 1; size < sequence.length; size++) {
        for (var i = 0; i < sequence.length-1-size; size++) {
            let key = sequence.slice(i, i+size);
            var repeat = true;
            for (var j = i+size; j < sequence.length-1-size; j+= size) {
                if (JSON.stringify(sequence.slice(j, j+size))!= JSON.stringify(key)) {
                    repeat = false;
                }
            }
            if (repeat) {
                return key;
            }
        }
    }
    return sequence;
}

private findDraftPatterns(treadlingPatterns, treadling, threadingPatterns, threading, draft) {
    var treadlingString: string = this.toString(treadling);
    var threadingString: string = this.toString(threading);


    var treadlingRanges = [];
    var threadingRanges = [];


    let idxTreadling = treadlingString.indexOf(treadlingPatterns);
    var length = -1;

    for (var j = 0; j < treadlingString.length; j++) {
        if (j == idxTreadling) {
            length += 1;
            break;
        }
        if (treadlingString[j] == ",") {
            length += 1;
        }
    }
    treadlingRanges.push([length, treadlingPatterns.length]);

    let idxThreading = threadingString.indexOf(threadingPatterns);
    var length = -1;

    for (var j = 0; j < threadingString.length; j++) {
        if (j == idxThreading) {
            length += 1;
            break;
        }
        if (threadingString[j] == ",") {
            length += 1;
        }
    }
    threadingRanges.push([length, threadingPatterns.length]);

    var draftPatterns = [];
    for (var i = 0; i < treadlingRanges.length; i++) {
        for (var j = 0; j < threadingRanges.length; j++) {
            var pattern = [];
            var counter = -1;
            for (var idxWeft = treadlingRanges[i][0]; idxWeft < treadlingRanges[i][1]; idxWeft += 1) {
                counter += 1;
                pattern.push([]);
                for (var idxWarp = threadingRanges[j][0]; idxWarp < threadingRanges[j][1]; idxWarp += 1) {
                    pattern[counter].push(draft[idxWeft][idxWarp]);
                }
            }
            draftPatterns.push(pattern);
        }
    }
    var transformedDraftPatterns = [];

    for (var i = 0; i < draftPatterns.length; i++) {
        transformedDraftPatterns.push([]);
        for (var j = 0; j < draftPatterns[i].length; j++) {                
            transformedDraftPatterns[i].push([]);
            for(var k = 0; k < draftPatterns[i][j].length; k++) {
                if (draftPatterns[i][j][k] == 1 || draftPatterns[i][j][k].is_up) {
                    transformedDraftPatterns[i][j].push(1);
                } else {
                    transformedDraftPatterns[i][j].push(0);
                }
            }
        }
    }
    return transformedDraftPatterns[0];
}

  public computePatterns(threading, treadling, draft) {

      let threadingPatterns = this.findPatterns(threading);
      let treadlingPatterns = this.findPatterns(treadling);

      return this.findDraftPatterns(treadlingPatterns, treadling, threadingPatterns, threading, draft);
  }
}
