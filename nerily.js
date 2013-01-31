function showNotification(title, body) {
    webkitNotifications.createNotification(
        '48.png', // icon url - can be relative
        title, // notification title
        body  // notification body text
    ).show();
}

function onClickHandler(info, tab) {
    //new label
    if (info.menuItemId == "newLabel") {
        var lbl = window.prompt("What is the name of this label? (Example: ADDR)");
        chrome.storage.local.get("labels", function (r) {
            var labels = r["labels"];
            if (labels == null) {
                labels = [];
            }

            if (!labels.indexOf(lbl) > -1) {
                labels.push(lbl);
                chrome.storage.local.set({"labels":labels}, function () {
                    chrome.contextMenus.create({
                        "title":"Label this as " + lbl,
                        "contexts":["selection"],
                        "id":"lbl" + lbl
                    })
                });
            }
        });
    }

    //labeling clicks
    else if (info.menuItemId.substr(0, 3) == "lbl") {
        var selectedText = info.selectionText;
        var lbl = info.menuItemId.substr(3);
        chrome.tabs.executeScript(tab.id, {file:"contentscript.js"}, function () {
            chrome.tabs.sendRequest(tab.id, {method:"getText"}, function (response) {
                if (response.method == "getText") {
                    allText = response.data;
                    label(lbl, selectedText, allText)
                }
            });
        });
    }
};

function downloadTsv() {
    chrome.storage.local.get("documents", function (r) {
        var documents = r["documents"];
        if (documents == null) {
            documents = [];
        }
        console.log(documents.length);

        var tsvStr = "";
        for (var page = 0; page < documents.length; page++) {
            var doc = documents[page];
            var bodyText = doc["text"];
            bodyText = _strip(_nl2space(bodyText));

            var words = bodyText.split(" ");
            for (var i = 0; i < words.length; i++) {

                //check if it matches label
                var matchLbl = false;
                for (var j = 0; j < doc["labels"].length; j++) {
                    var labelDic = doc["labels"][j];
                    var toLoop = _label_matches_words(labelDic, words, i);
                    if (toLoop > -1) {
                        for (var k = 0; k < toLoop; k++) {
                            var idx = i + k;
                            var word = words[idx];
                            tsvStr += word + "\t" + labelDic["name"] + "\n";
                        }
                        i = idx;
                        matchLbl = true;
                        break;
                    }
                }

                //does not match
                if (!matchLbl) {
                    var word = words[i];
                    tsvStr += word + "\t0\n";
                }
            }
        }

        var url = "data:text/tab-separated-values;charset=utf-8," + encodeURIComponent(tsvStr);
        chrome.tabs.create({url:url});
    });
}

/*
 Checks if a label matches the words from the text body given the index and its word tokens.
 Returns -1 if it does not match, and a positive integer for the length of labeled text.
 */
function _label_matches_words(labelDic, bodyTextWords, idx) {
    var lbl, selectedTxt, selectedWords, matchLbl;
    lbl = labelDic["name"];
    selectedTxt = _strip(_nl2space(labelDic["selected"]));
    selectedWords = selectedTxt.split(" ");

    //matching check
    matchLbl = true;
    for (var i = 0; i < selectedWords.length; i++) {
        var selectedWord, bodyTextWord;
        selectedWord = selectedWords[i];
        bodyTextWord = bodyTextWords[idx + i];
        if (selectedWord != bodyTextWord) {
            matchLbl = false;
            break;
        }
    }

    if (matchLbl) {
        return selectedWords.length;
    }
    else {
        return -1;
    }
}

function _strip(txt) {
    return txt.replace(/[\s\r]+/g, ' ');
}

function _nl2space(txt) {
    return txt.replace(/[\n]+/g, ' ');
}

function label(lbl, selectedText, bodyOfText) {
    chrome.storage.local.get("documents", function (r) {
        var documents = r["documents"];
        if (documents == null) {
            documents = [];
        }

        var label = {
            "name":lbl,
            "selected":selectedText
        }
        var doc = {
            "text":bodyOfText,
            "labels":[]
        }
        var documentIdx = -1;
        for (var i = 0; i < documents.length; i++) {
            var document = documents[i];
            if (document["text"] == bodyOfText) {
                doc = document;
                documentIdx = i;
                break;
            }
        }
        doc["labels"].push(label);

        if (documentIdx == -1) {
            documents.push(doc);
        }

        //save it
        chrome.storage.local.set({"documents":documents}, function () {
        });
    });
}

function dumpObjectIndented(obj, indent) {
    var result = "";
    if (indent == null) indent = "";

    for (var property in obj) {
        var value = obj[property];
        if (typeof value == 'string')
            value = "'" + value + "'";
        else if (typeof value == 'object') {
            if (value instanceof Array) {
                // Just let JS convert the Array to a string!
                value = "[ " + value + " ]";
            }
            else {
                // Recursive dump
                // (replace "  " by "\t" or something else if you prefer)
                var od = dumpObjectIndented(value, indent + "  ");
                // If you like { on the same line as the key
                //value = "{\n" + od + "\n" + indent + "}";
                // If you prefer { and } to be aligned
                value = "\n" + indent + "{\n" + od + "\n" + indent + "}";
            }
        }
        result += indent + "'" + property + "' : " + value + ",\n";
    }
    return result.replace(/,\n$/, "");
}

chrome.contextMenus.onClicked.addListener(onClickHandler);

// Set up context menu tree at install time.
chrome.runtime.onInstalled.addListener(function () {

    //reset
//    chrome.storage.local.set({"documents":[]}, function () {
//    });

    chrome.contextMenus.create({
        "title":"Label this as ..",
        "contexts":["selection"],
        "id":"newLabel"
    })

    chrome.storage.local.get("labels", function (r) {
        var labels = r["labels"];
        if (labels == null) {
            labels = [];
        }

        for (var i = 0; i < labels.length; i++) {
            lbl = labels[i];
            chrome.contextMenus.create({
                "title":"Label this as " + lbl,
                "contexts":["selection"],
                "id":"lbl" + lbl
            })
        }
    });
});
