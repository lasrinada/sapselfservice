sap.ui.define(["./DocumentController"], function (Documents) {
    "use strict";

    return Documents.extend("sapselfservice.controller.PayStatements", {
        onInit() { this.loadDocuments("PayStatements", "pay", "payStatements", "filteredPayStatements"); },
        onPayStatementViewPress(event) { this.openDocument(event); }
    });
});
