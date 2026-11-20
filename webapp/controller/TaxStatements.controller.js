sap.ui.define(["./DocumentController"], function (Documents) {
    "use strict";

    return Documents.extend("sapselfservice.controller.TaxStatements", {
        onInit() { this.loadDocuments("TaxStatements", "tax", "taxStatements", "filteredTaxStatements"); },
        onTaxStatementViewPress(event) { this.openDocument(event); }
    });
});
